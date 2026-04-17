"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TreePine, Plus, Users, LogOut, Eye, Search } from "lucide-react"
import TreeSearchDialog from "@/components/tree-search-dialog"

export default function DashboardPage() {
  const [familyTrees, setFamilyTrees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [user, setUser] = useState(null)
  const [showTreeSearch, setShowTreeSearch] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/auth/login")
      return
    }

    // Decode token to get user info
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      setUser(payload)
    } catch (error) {
      console.error("Error decoding token:", error)
    }

    fetchFamilyTrees()
  }, [router])

  const fetchFamilyTrees = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/family-trees", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setFamilyTrees(data.trees)
      } else {
        setError("Failed to fetch family trees")
      }
    } catch (error) {
      setError("An error occurred while fetching family trees")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <TreePine className="h-12 w-12 text-green-600 mx-auto mb-4 animate-pulse" />
          <p className="text-lg text-gray-600">Loading your family trees...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TreePine className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Family Tree</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">
              Welcome, {user?.firstName} {user?.lastName}
            </span>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your Family Trees</h2>
            <p className="text-gray-600 mt-2">Manage and explore your family history</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={() => router.push("/family-tree/create")}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Tree
            </Button>
            <Button variant="outline" onClick={() => setShowTreeSearch(true)}>
              <Search className="h-4 w-4 mr-2" />
              Search Trees
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {familyTrees.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <TreePine className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Family Trees Yet</h3>
              <p className="text-gray-600 mb-6">
                Start building your family history by creating your first family tree
              </p>
              <Button onClick={() => router.push("/family-tree/create")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Tree
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {familyTrees.map((tree) => (
              <Card key={tree._id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="h-5 w-5 mr-2 text-green-600" />
                    {tree.lastName} Family
                  </CardTitle>
                  <CardDescription>
                    Root: {tree.rootPerson?.firstName} {tree.rootPerson?.lastName}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Created: {new Date(tree.createdAt).toLocaleDateString()}
                    </div>
                    <Button size="sm" onClick={() => router.push(`/family-tree/${tree._id}`)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View Tree
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      {/* Tree Search Dialog */}
      <TreeSearchDialog open={showTreeSearch} onOpenChange={setShowTreeSearch} />
    </div>
  )
}
