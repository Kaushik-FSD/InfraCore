import bcrypt from 'bcrypt';
import { FastifyInstance } from 'fastify';
import {prisma} from "../../utils/prisma"

const SALT_ROUNDS = 10

export class AuthService {

    private app: FastifyInstance  // declare the property

    constructor(app: FastifyInstance) {
        this.app = app  // store it on the instance
    }

    async signup(email: string, password: string) {
        const checkUserExists = await prisma.user.findUnique({ 
            where: { email } 
        })

        if(checkUserExists){
            throw { statusCode: 409, message: 'Email already in use' }
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

        // Create user
        const user = await prisma.user.create({
            data: { email, passwordHash },
        })

        return {
            message: 'Signup successful',
            user: { id: user.id, email: user.email },
        }
    }

    async login(email: string, password: string) {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            throw { statusCode: 401, message: 'Invalid email or password' }
        }

        // Verify password
        const valid = await bcrypt.compare(password, user.passwordHash)

        if (!valid) {
            throw { statusCode: 401, message: 'Invalid email or password' }
        }

        const accessToken = this.app.jwt.sign(
            { 
                userId: user.id, email: user.email 
            },
            { expiresIn: '15m' }
        )

        const refreshToken = this.app.jwt.sign(
            { 
                userId: user.id, type: 'refresh' 
            },
            { expiresIn: '7d' }
        )

        return { accessToken, refreshToken }
    }

    async refresh(refreshToken: string) {
        // Verify the refresh token
        let payload: { userId: string; type: string }

        try {
            payload = this.app.jwt.verify(refreshToken)
        } catch {
            throw { statusCode: 401, message: 'Invalid or expired refresh token' }
        }

        if (payload.type !== 'refresh') {
            throw { statusCode: 401, message: 'Invalid token type' }
        }

        // Check if token is blacklisted in Redis
        const blacklisted = await this.app.redis.get(`blacklist:${refreshToken}`)
        if (blacklisted) {
            throw { statusCode: 401, message: 'Token has been revoked' }
        }

        // Issue new access token
        const accessToken = this.app.jwt.sign(
            { userId: payload.userId },
            { expiresIn: '15m' }
        )

        return { accessToken }
    }

    async logout(refreshToken: string) {
        // Blacklist the refresh token in Redis
        // TTL of 7 days — same as refresh token expiry
        await this.app.redis.set(
            `blacklist:${refreshToken}`,
            '1',
            'EX',
            60 * 60 * 24 * 7
        )

        return { message: 'Logged out successfully' }
    }
}