"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TreePine, ArrowLeft, Users } from "lucide-react"

export default function CreateFamilyTreePage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    placeOfBirth: "",
    occupation: "",
    currentAddress: "",
    gender: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checkingLastName, setCheckingLastName] = useState(false)
  const [lastNameExists, setLastNameExists] = useState(false)
  const [existingTreeId, setExistingTreeId] = useState("")
  const router = useRouter()
  const [photoPreview, setPhotoPreview] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/auth/login")
      return
    }
  }, [router])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSelectChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const photoData = e.target.result
        setFormData({
          ...formData,
          photo: photoData,
        })
        setPhotoPreview(photoData)
      }
      reader.readAsDataURL(file)
    }
  }

  const checkLastNameAvailability = async (lastName) => {
    if (!lastName.trim()) {
      setLastNameExists(false)
      setExistingTreeId("")
      return
    }

    setCheckingLastName(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/family-trees/check/${encodeURIComponent(lastName)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()
      setLastNameExists(Boolean(data.exists))
      setExistingTreeId(data.treeId || "")
    } catch (error) {
      console.error("Error checking last name:", error)
    } finally {
      setCheckingLastName(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.lastName) {
        checkLastNameAvailability(formData.lastName)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [formData.lastName])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/family-trees/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        router.push(`/family-tree/${data.treeId}`)
      } else {
        setError(data.message || "Failed to create family tree")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center space-x-2">
            <TreePine className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-bold text-gray-900">Create Family Tree</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Start Your Family Tree</CardTitle>
              <CardDescription>Begin by adding yourself as the root person of your family tree</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                      placeholder="Enter your first name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                      placeholder="Enter your last name"
                    />
                    {checkingLastName && <p className="text-sm text-gray-500">Checking availability...</p>}
                    {lastNameExists && (
                      <div className="text-sm text-amber-700 space-y-1">
                        <p>A family tree with this surname already exists.</p>
                        {existingTreeId && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-amber-700"
                            onClick={() => router.push(`/family-tree/${existingTreeId}`)}
                          >
                            Open Existing Tree
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" name="dob" type="date" value={formData.dob} onChange={handleChange} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select onValueChange={(value) => handleSelectChange("gender", value)} value={formData.gender}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="photo">Photo (Optional)</Label>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-300 overflow-hidden flex items-center justify-center">
                      {photoPreview ? (
                        <img
                          src={photoPreview || "/placeholder.svg"}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        id="photo"
                        name="photo"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-gray-500 mt-1">Upload a photo (JPG, PNG, GIF)</p>
                    </div>
                    {photoPreview && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData({ ...formData, photo: "" })
                          setPhotoPreview("")
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="placeOfBirth">Place of Birth</Label>
                  <Input
                    id="placeOfBirth"
                    name="placeOfBirth"
                    value={formData.placeOfBirth}
                    onChange={handleChange}
                    placeholder="Enter your place of birth"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleChange}
                    placeholder="Enter your occupation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentAddress">Current Address</Label>
                  <Input
                    id="currentAddress"
                    name="currentAddress"
                    value={formData.currentAddress}
                    onChange={handleChange}
                    placeholder="Enter your current address"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Family Tree..." : "Create Family Tree"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
