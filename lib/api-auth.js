import { ObjectId } from "mongodb"
import { verifyToken } from "@/lib/auth"

function unauthorized(message = "Unauthorized") {
  return Response.json({ message }, { status: 401 })
}

export async function requireAuthUser(request, db) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { errorResponse: unauthorized("Unauthorized") }
  }

  const token = authHeader.split(" ")[1]
  const decoded = verifyToken(token)
  if (!decoded) {
    return { errorResponse: unauthorized("Invalid token") }
  }

  const userId = decoded.userId
  if (!userId) {
    return { errorResponse: unauthorized("Invalid token payload") }
  }

  let objectId
  try {
    objectId = new ObjectId(String(userId))
  } catch {
    return { errorResponse: unauthorized("Invalid token payload") }
  }

  const user = await db.collection("users").findOne({ _id: objectId })
  if (!user) {
    return { errorResponse: unauthorized("User not found") }
  }

  return { user, decoded }
}
