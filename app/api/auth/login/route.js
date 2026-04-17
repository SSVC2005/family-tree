import { verifyPassword, generateToken } from "@/lib/auth"
import { findUserByEmail } from "@/lib/db-operations"

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return Response.json({ message: "Email and password are required" }, { status: 400 })
    }

    // Find user
    const user = await findUserByEmail(email)
    if (!user) {
      return Response.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const isValidPassword = verifyPassword(password, user.password)
    if (!isValidPassword) {
      return Response.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Generate token
    const token = generateToken({
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    })

    return Response.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
