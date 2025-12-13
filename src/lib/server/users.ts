import { createServerFn } from '@tanstack/react-start'
import { users } from '@/db/schema'
import { eq, getTableColumns } from 'drizzle-orm'
import { db } from '@/db'

export const fetchUserInfo = createServerFn()
  .inputValidator((data: { userId: number }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users)
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1)
    return user
  })

export const fetchUserInfoByEmail = createServerFn()
  .inputValidator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { email, ...userColumns } = getTableColumns(users)
    const user = await db
      .select(userColumns)
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)
    return user
  })
