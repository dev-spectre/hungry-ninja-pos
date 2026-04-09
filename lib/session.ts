import { jwtVerify, SignJWT } from 'jose'

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'secret123456789012345678901234567890');

export type SessionPayload = {
  id: string
  name: string
  role: string
  branchId: string | null
  permissions?: any
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    if (!session) return null;
    const { payload } = await jwtVerify(session, secretKey, {
      algorithms: ['HS256'],
    })
    return payload as SessionPayload
  } catch (error) {
    return null
  }
}
