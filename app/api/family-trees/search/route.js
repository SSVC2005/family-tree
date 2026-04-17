import clientPromise from "@/lib/mongodb"
import { requireAuthUser } from "@/lib/api-auth"
import { buildTreeCardForClient, getTreePermissions, normalizeTreeDocument, saveTree } from "@/lib/family-tree-service"

export const dynamic = "force-dynamic"

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = (searchParams.get("q") || "").trim()

    if (!query || query.length < 2) {
      return Response.json({ trees: [] })
    }

    const client = await clientPromise
    const db = client.db("familytree")

    const { user, errorResponse } = await requireAuthUser(request, db)
    if (errorResponse) return errorResponse

    const escapedQuery = escapeRegex(query)
    const regex = new RegExp(escapedQuery, "i")

    const rawTrees = await db
      .collection("familytrees")
      .find({
        $or: [
          { lastName: { $regex: escapedQuery, $options: "i" } },
          { normalizedLastName: query.toLowerCase() },
          { "members.firstName": { $regex: escapedQuery, $options: "i" } },
          { "members.lastName": { $regex: escapedQuery, $options: "i" } },
          { "rootPerson.firstName": { $regex: escapedQuery, $options: "i" } },
          { "rootPerson.lastName": { $regex: escapedQuery, $options: "i" } },
        ],
      })
      .limit(20)
      .toArray()

    const treesWithPermissions = []
    for (const rawTree of rawTrees) {
      const { tree, changed } = normalizeTreeDocument(rawTree)
      if (changed) {
        await saveTree(db, tree)
      }

      const permissions = getTreePermissions(tree, user)
      const card = buildTreeCardForClient(tree)

      const hasMemberMatch =
        tree.members?.some((member) => {
          const fullName = `${member.firstName || ""} ${member.lastName || ""}`
          return regex.test(fullName)
        }) || false

      treesWithPermissions.push({
        ...card,
        canEdit: permissions.canEdit,
        isOwner: permissions.isOwner,
        hasMemberMatch,
      })
    }

    return Response.json({ trees: treesWithPermissions })
  } catch (error) {
    console.error("Search trees error:", error)
    return Response.json({ message: "Internal server error" }, { status: 500 })
  }
}
