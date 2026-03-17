import { prisma } from "../../utils/prisma"
import { Role } from "@prisma/client"

export class OrgService {
    async createOrg(userId: string, name: string, slug: string) {

        const existing = await prisma.organization.findUnique({
            where: {slug}
        })

        if(existing){
            throw { statusCode: 409, message: 'Slug already taken' }
        }

        // $transaction executes multiple operations in a single database transaction. 
        // If any operation fails, all changes are rolled back.
        const org = await prisma.$transaction(
            async (tx) => {
                //create a new org
                const newOrg = await tx.organization.create({
                    data: { name, slug }
                })

                //create orgMember
                await tx.orgMember.create({
                    data: {
                        userId,
                        orgId: newOrg.id,
                        role: Role.ADMIN,
                    }
                })

                return newOrg
            }
        )
        /*
            return { org }       // returns → { org: { id: '...', name: '...', ... } }
            return org           // returns → { id: '...', name: '...', ... }
        */
        return { org }
    }

    async getOrg(userId: string, orgId: string) {
        // Check user is a member of this org
        const membership = await prisma.orgMember.findUnique({
        where: { userId_orgId: { userId, orgId } },
        })

        if (!membership) {
            throw { statusCode: 403, message: 'You are not a member of this org' }
        }

        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, email: true },
                        },
                    },
                },
            },
        })

        if (!org) {
            throw { statusCode: 404, message: 'Organization not found' }
        }

        return { org }
    }

    async inviteMember(requesterId: string, orgId: string, email: string, role: Role) {
        // Check requester is ADMIN
        const requesterMembership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId: requesterId, orgId } },
        })

        if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
            throw { statusCode: 403, message: 'Only admins can invite members' }
        }

        // Check invited user exists
        const invitedUser = await prisma.user.findUnique({
            where: { email },
        })

        if (!invitedUser) {
            throw { statusCode: 404, message: 'User not found' }
        }

        // Check not already a member
        const alreadyMember = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId: invitedUser.id, orgId } },
        })

        if (alreadyMember) {
            throw { statusCode: 409, message: 'User is already a member of this org' }
        }

        // Add member
        const member = await prisma.orgMember.create({
            data: {
                userId: invitedUser.id,
                orgId,
                role,
            },
            include: {
                user: {
                    select: { id: true, email: true },
                },
            },
        })

        return { member }
    }

    async updateMemberRole(requesterId: string, orgId: string, memberId: string, role: Role) {
        // Check requester is ADMIN
        const requesterMembership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId: requesterId, orgId } },
        })

        if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
            throw { statusCode: 403, message: 'Only admins can update roles' }
        }

        // Check target member exists in org
        const targetMembership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId: memberId, orgId } },
        })

        if (!targetMembership) {
            throw { statusCode: 404, message: 'Member not found in this org' }
        }

        // Update role
        const updated = await prisma.orgMember.update({
            where: { userId_orgId: { userId: memberId, orgId } },
            data: { role },
            include: {
                user: {
                    select: { id: true, email: true },
                },
            },
        })

        return { member: updated }
    }

    async removeMember(requesterId: string, orgId: string, memberId: string) {
        // Check requester is ADMIN
        const requesterMembership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId: requesterId, orgId } },
        })

        if (!requesterMembership || requesterMembership.role !== Role.ADMIN) {
            throw { statusCode: 403, message: 'Only admins can remove members' }
        }

        // Prevent removing yourself
        if (requesterId === memberId) {
            throw { statusCode: 400, message: 'You cannot remove yourself from the org' }
        }

        // Check target member exists
        const targetMembership = await prisma.orgMember.findUnique({
            where: { userId_orgId: { userId: memberId, orgId } },
        })

        if (!targetMembership) {
            throw { statusCode: 404, message: 'Member not found in this org' }
        }

        await prisma.orgMember.delete({
            where: { userId_orgId: { userId: memberId, orgId } },
        })

        return { message: 'Member removed successfully' }
    }
}