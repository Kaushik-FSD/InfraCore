import bcrypt from 'bcrypt'
import { prisma } from '../../utils/prisma'
import { Role } from '@prisma/client'
import { WebhookService } from '../webhook/service'

const SALT_ROUNDS = 10

const generateApiKey = (): { fullKey: string; prefix: string } => {
  // generates a random string like: ic_live_xK9mN2pL4qR7sT3uV8wX
  const randomPart = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
  const prefix = 'ic_live'
  const fullKey = `${prefix}_${randomPart}`
  return { fullKey, prefix }
}

const webhookService = new WebhookService()

export class ApiKeyService {

    async createApiKey(
        userId: string,
        orgId: string,
        name: string,
        permissions: string[],
        rateLimit: number,
        expiresAt?: string
    ) {
        // Check user is ADMIN of this org
        const membership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId, orgId } },
        })

        if (!membership || membership.role !== Role.ADMIN) {
            throw { statusCode: 403, message: 'Only admins can create API keys' }
        }

        // Generate key
        const { fullKey, prefix } = generateApiKey()

        // Hash the full key
        const keyHash = await bcrypt.hash(fullKey, SALT_ROUNDS)

        // Store in DB
        const apiKey = await prisma.apiKey.create({
            data: {
                name,
                keyHash,
                keyPrefix: prefix,
                permissions,
                rateLimit,
                orgId,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        })

        await webhookService.triggerWebhook(orgId, 'api_key.created', {
            keyId: apiKey.id,
            name: apiKey.name,
            permissions: apiKey.permissions,
        })

        // Return full key ONCE — never retrievable again
        return {
            id: apiKey.id,
            name: apiKey.name,
            key: fullKey,        // ← shown once only
            keyPrefix: prefix,
            permissions: apiKey.permissions,
            rateLimit: apiKey.rateLimit,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
            message: 'Store this key safely — it will never be shown again',
        }
    }

    /*
    It returns ALL keys belonging to an org — active, expired, and revoked. Not just the current one.
    */
    async listApiKeys(userId: string, orgId: string) {
        // Check user is a member of this org
        const membership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId, orgId } },
        })

        if (!membership) {
            throw { statusCode: 403, message: 'You are not a member of this org' }
        }

        const keys = await prisma.apiKey.findMany({
            where: { orgId },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                permissions: true,
                rateLimit: true,
                usageCount: true,
                lastUsedAt: true,
                expiresAt: true,
                createdAt: true,
                revokedAt: true,
                // keyHash is NEVER returned
            },
        })
        return { keys }
    }

    async revokeApiKey(userId: string, orgId: string, keyId: string) {
        // Check user is ADMIN
        const membership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId, orgId } },
        })

        if (!membership || membership.role !== Role.ADMIN) {
        throw { statusCode: 403, message: 'Only admins can revoke API keys' }
        }

        // Check key exists and belongs to this org
        const key = await prisma.apiKey.findFirst({
            where: { id: keyId, orgId },
        })

        if (!key) {
            throw { statusCode: 404, message: 'API key not found' }
        }

        if (key.revokedAt) {
            throw { statusCode: 409, message: 'API key is already revoked' }
        }

        // Revoke it
        await prisma.apiKey.update({
            where: { id: keyId },
            data: { 
                revokedAt: new Date() 
            },
        })

        await webhookService.triggerWebhook(orgId, 'api_key.revoked', {
            keyId,
        })

        return { message: 'API key revoked successfully' }
    }

    /*
    This method is called by our middleware every time a request comes in with an X-API-Key header. 
    Its job is to answer one question — is this key valid and who does it belong to?
    */
    async verifyApiKey(rawKey: string): Promise<{
        orgId: string
        keyId: string
        permissions: string[]
        rateLimit: number
    }> 
    {
        // Extract prefix from key
        const parts = rawKey.split('_')  //eg: ic_live_xK9mN2pL4qR7sT3uV8wX
        if (parts.length < 3) {
            throw { statusCode: 401, message: 'Invalid API key format' }
        }

        const prefix = `${parts[0]}_${parts[1]}` // ic_live

        // Find keys with this prefix
        const candidates = await prisma.apiKey.findMany({
            where: {
                keyPrefix: prefix,
                revokedAt: null,
            },
        })

        if (candidates.length === 0) {
            throw { statusCode: 401, message: 'Invalid API key' }
        }

        // Find matching key by comparing hashes
        let matchedKey = null
        for (const candidate of candidates) {
            const match = await bcrypt.compare(rawKey, candidate.keyHash)
            if (match) {
                matchedKey = candidate
                break
            }
        }

        if (!matchedKey) {
            throw { statusCode: 401, message: 'Invalid API key' }
        }

        // Check expiry
        if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
            throw { statusCode: 401, message: 'API key has expired' }
        }

        // Update lastUsedAt and increment usageCount
        await prisma.apiKey.update({
            where: { id: matchedKey.id },
            data: {
                lastUsedAt: new Date(),
                usageCount: { increment: 1 },
            },
        })

        return {
            orgId: matchedKey.orgId,
            keyId: matchedKey.id,
            permissions: matchedKey.permissions,
            rateLimit: matchedKey.rateLimit,
        }
    }
}