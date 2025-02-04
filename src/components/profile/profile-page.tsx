"use client";

import { useAuthGuard } from "@/hooks/use-auth-guard";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import type { User } from "@/types/user";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MainLayout } from "@/components/layout/main-layout";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { ProtectedPageWrapper } from "@/components/auth/protected-page-wrapper";
import { useClerk } from "@clerk/nextjs";
import { useProtectedFetch } from "@/hooks/use-protected-fetch";
import { useRouter } from "next/navigation";
import { useAuthService } from "@/lib/services/auth.service";

// Remove validation schema since fields are no longer required
const profileSchema = z.object({
  location: z.string().optional(),
  dateOfBirth: z.date().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),
  livingStatus: z.enum(['single', 'couple', 'family', 'shared', 'other']).optional(),
});

interface ProfilePageProps {
  initialUser: {
    id: string;
    username: string | null;
    fullName: string | null;
    imageUrl: string;
  };
}

function ProfileSkeleton() {
  return (
    <MainLayout>
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">
          {/* Profile Header Skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 px-4 sm:px-6 lg:px-8 gap-4 border-b">
            <div className="flex items-center gap-6">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>

          {/* Profile Sections Skeleton */}
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="py-6 space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export function ProfilePage({ initialUser }: ProfilePageProps) {
  const router = useRouter();
  const { isReady } = useAuthGuard({ protected: true });
  const { user, isSignedIn } = useAuthService();
  const { openUserProfile } = useClerk();
  const { fetchWithAuth } = useProtectedFetch();
  const [isLoading, setIsLoading] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(true);
  const [shouldShowSkeleton, setShouldShowSkeleton] = useState(false);
  const [profileData, setProfileData] = useState<Partial<User>>({
    bio: "",
    location: "",
    dateOfBirth: undefined,
    gender: undefined,
    livingStatus: undefined
  });

  // Only show skeleton after a delay if still loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady || !isSignedIn) {
        setShouldShowSkeleton(true);
      }
    }, 200); // Small delay to prevent flash

    return () => clearTimeout(timer);
  }, [isReady, isSignedIn]);

  // Check if profile is complete
  useEffect(() => {
    let isMounted = true;

    async function checkProfile() {
      try {
        const response = await fetchWithAuth('/api/profile');
        const { user: userData, profile } = await response.json();
        
        if (userData && isMounted) {
          setProfileData({
            bio: profile?.bio || "",
            location: profile?.location || "",
            dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth) : undefined,
            gender: profile?.gender || undefined,
            livingStatus: profile?.livingStatus || undefined
          });
          setIsProfileComplete(profile?.profileComplete ?? false);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        if (isMounted) {
          toast.error('Failed to load profile data');
        }
      }
    }

    if (isSignedIn && isReady) {
      checkProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [isReady, isSignedIn]);

  // Handle form submission
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      profileSchema.parse({
        location: profileData.location,
        dateOfBirth: profileData.dateOfBirth,
        gender: profileData.gender,
        livingStatus: profileData.livingStatus,
      });

      const response = await fetchWithAuth('/api/profile', {
        method: 'POST',
        body: JSON.stringify(profileData),
      });

      const { user } = await response.json();
      
      if (user) {
        toast.success('Profile updated successfully');
        setIsProfileComplete(true);
        // Navigate to the user's profile page
        router.push(`/profile/${user.username}`);
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error instanceof z.ZodError) {
        error.errors.forEach(err => {
          toast.error(err.message);
        });
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Update form fields
  const handleChange = (field: keyof User, value: User[keyof User]) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Show skeleton after delay if still loading
  if (shouldShowSkeleton && (!isReady || !isSignedIn)) {
    return <ProfileSkeleton />;
  }

  // Show nothing during initial load to prevent flash
  if (!isReady || !isSignedIn) {
    return null;
  }

  // Use initialUser if authenticated user is not available yet
  const displayUser = user || initialUser;

  return (
    <ProtectedPageWrapper initialUser={initialUser} layoutType="main">
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">
          {/* Profile Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-6 px-4 sm:px-6 lg:px-8 gap-4 border-b">
            <div className="flex items-center gap-6">
              <Image
                src={displayUser.imageUrl || '/images/default-avatar.png'}
                alt={displayUser.username || "Profile"}
                width={64}
                height={64}
                className="rounded-full"
              />
              <div>
                <h1 className="text-2xl font-bold">{displayUser.fullName || displayUser.username}</h1>
                <p className="text-muted-foreground">@{displayUser.username}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openUserProfile()}
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Account
              </Button>
              <Link href="/profile/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Privacy Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Profile Sections */}
          <div className="px-4 sm:px-6 lg:px-8">
            {/* Bio Section */}
            <div className="py-6 border-b">
              <h3 className="text-lg font-semibold mb-1">Bio</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {!isProfileComplete 
                  ? "Optional - You can add this later" 
                  : "Tell others about yourself"
                }
              </p>
              <Textarea
                value={profileData.bio || ''}
                onChange={(e) => handleChange('bio', e.target.value)}
                placeholder="Write a short bio..."
                className="min-h-[100px]"
                maxLength={300}
              />
              <div className="text-xs text-muted-foreground text-right mt-1">
                {(profileData.bio?.length || 0)}/300
              </div>
            </div>

            {/* Location Section */}
            <div className="py-6 border-b">
              <h3 className="text-lg font-semibold mb-1">Location</h3>
              <p className="text-sm text-muted-foreground mb-4">Where are you based?</p>
              <div className="space-y-2">
                <Input
                  value={profileData.location || ''}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="Enter your location"
                />
              </div>
            </div>

            {/* Personal Details Section */}
            <div className="py-6 border-b">
              <h3 className="text-lg font-semibold mb-1">Personal Details</h3>
              <p className="text-sm text-muted-foreground mb-4">Optional information to help personalize your experience</p>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input
                    type="date"
                    id="dob"
                    value={profileData.dateOfBirth 
                      ? new Date(profileData.dateOfBirth).toISOString().split('T')[0] 
                      : ''
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange('dateOfBirth', value ? new Date(value) : undefined);
                    }}
                    className="[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:grayscale [&::-webkit-calendar-picker-indicator]:invert"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={profileData.gender || ''}
                    onValueChange={(value: string) => handleChange('gender', value as 'male' | 'female' | 'other' | 'prefer-not-to-say')}
                  >
                    <SelectTrigger 
                      className="bg-background"
                    >
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="living-status">Living Status</Label>
                  <Select
                    value={profileData.livingStatus || ''}
                    onValueChange={(value: string) => handleChange('livingStatus', value as 'single' | 'couple' | 'family' | 'shared' | 'other')}
                  >
                    <SelectTrigger 
                      className="bg-background"
                    >
                      <SelectValue placeholder="Select living status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="couple">Couple</SelectItem>
                      <SelectItem value="family">Family</SelectItem>
                      <SelectItem value="shared">Shared</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky footer with save button */}
        <div className="sticky bottom-0 border-t bg-background py-4">
          <div className="px-4 sm:px-6 lg:px-8">
            <Button 
              type="button"
              size="lg"
              disabled={isLoading}
              onClick={handleSubmit}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {!isProfileComplete ? 'Creating Profile...' : 'Saving Changes...'}
                </>
              ) : (
                !isProfileComplete ? 'Create Profile & Continue' : 'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </ProtectedPageWrapper>
  );
} 