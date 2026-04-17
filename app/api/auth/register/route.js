import { hashPassword, generateToken } from "@/lib/auth"
import { createUser, findUserByEmail } from "@/lib/db-operations"

export async function POST(request) {
  try {
    const { firstName, lastName, email, password } = await request.json()

    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return Response.json({ message: "All fields are required" }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return Response.json({ message: "Invalid email format" }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return Response.json({ message: "Password must be at least 8 characters long" }, { status: 400 })
    }
    if (!/[A-Z]/.test(password)) {
      return Response.json({ message: "Password must contain at least one uppercase letter" }, { status: 400 })
    }
    if (!/[a-z]/.test(password)) {
      return Response.json({ message: "Password must contain at least one lowercase letter" }, { status: 400 })
    }
    if (!/[0-9]/.test(password)) {
      return Response.json({ message: "Password must contain at least one number" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email)
    if (existingUser) {
      return Response.json({ message: "User already exists" }, { status: 400 })
    }

    // Hash password and create user
    const hashedPassword = hashPassword(password)
    const result = await createUser({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    })

    // Generate token
    const token = generateToken({
      userId: result.insertedId,
      email,
      firstName,
      lastName,
    })

    return Response.json({
      message: "User created successfully",
      token,
      user: {
        id: result.insertedId,
        firstName,
        lastName,
        email,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
