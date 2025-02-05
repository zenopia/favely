"use client";

import { useState } from "react";
import { UserProfileBase } from "@/components/users/user-profile-base";
import type { User } from "@/types/user";

interface UserProfileProps {
  username: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  stats: {
    followers: number;
    following: number;
    lists: number;
  };
  isFollowing: boolean;
  hideFollow?: boolean;
  userData?: Partial<User>;
  showEditButton?: boolean;
  location?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  livingStatus?: string | null;
  privacySettings?: {
    showBio?: boolean;
    showLocation?: boolean;
    showPersonalDetails?: boolean;
    showDateOfBirth?: boolean;
    showGender?: boolean;
    showLivingStatus?: boolean;
  };
  variant?: "full" | "card" | "compact";
  showLocation?: boolean;
  showStats?: boolean;
}

export function UserProfile({
  username,
  fullName,
  firstName,
  lastName,
  bio,
  imageUrl,
  stats,
  isFollowing,
  hideFollow,
  showEditButton,
  location,
  dateOfBirth,
  gender,
  livingStatus,
  privacySettings,
  variant = "card",
  showLocation = true,
  showStats = false
}: UserProfileProps) {
  return (
    <UserProfileBase
      username={username}
      fullName={fullName}
      firstName={firstName}
      lastName={lastName}
      bio={bio}
      imageUrl={imageUrl}
      stats={stats}
      isFollowing={isFollowing}
      hideFollow={hideFollow}
      showEditButton={showEditButton}
      location={location}
      dateOfBirth={dateOfBirth}
      gender={gender}
      livingStatus={livingStatus}
      privacySettings={privacySettings}
      variant={variant}
      showLocation={showLocation}
      showStats={showStats}
    />
  );
} 