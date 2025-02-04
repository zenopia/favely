"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isValidEmail, cn } from "@/lib/utils";
import { useUsers } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface User {
  id: string;
  username: string;
  displayName: string;
  imageUrl?: string;
  avatarUrl?: string;
}

interface ApiUser {
  id: string;
  username: string;
  displayName: string;
  imageUrl?: string;
  avatarUrl?: string;
}

interface UserComboboxProps {
  onSelect: (value: { type: 'user', userId: string, username: string } | { type: 'email', email: string, note?: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  userIds?: string[];
  excludeUserIds?: string[];
}

export function UserCombobox({ 
  onSelect,
  placeholder = "Search users...", 
  disabled,
  userIds,
  excludeUserIds = []
}: UserComboboxProps) {
  const [searchValue, setSearchValue] = React.useState("");
  const [users, setUsers] = React.useState<User[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [showEmailNote, setShowEmailNote] = React.useState(false);
  const [emailNote, setEmailNote] = React.useState("");
  
  const { data: initialUsers, isLoading: isLoadingInitial } = useUsers(userIds);

  // Set initial users from the useUsers hook
  React.useEffect(() => {
    if (initialUsers && !searchValue) {
      setUsers(initialUsers
        .filter(user => !excludeUserIds.includes(user.id))
        .map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          imageUrl: user.imageUrl || undefined
        }))
      );
    }
  }, [initialUsers, searchValue, excludeUserIds]);

  // Search users as you type
  React.useEffect(() => {
    const searchUsers = async () => {
      if (!searchValue) {
        // Reset to initial users when search is cleared
        if (initialUsers) {
          setUsers(initialUsers
            .filter(user => !excludeUserIds.includes(user.id))
            .map(user => ({
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              imageUrl: user.imageUrl || undefined
            }))
          );
        }
        return;
      }

      // First, search through initial users
      if (initialUsers) {
        const localMatches = initialUsers
          .filter(user => 
            !excludeUserIds.includes(user.id) &&
            (user.username.toLowerCase().includes(searchValue.toLowerCase()) ||
             user.displayName.toLowerCase().includes(searchValue.toLowerCase()))
          )
          .map(user => ({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            imageUrl: user.imageUrl || undefined
          }));

        setUsers(localMatches);

        // If we have local matches, don't make an API call
        if (localMatches.length > 0) {
          return;
        }
      }
      
      // Only make API call if no local matches found
      try {
        setIsLoading(true);
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchValue)}`);
        if (!response.ok) throw new Error();
        const { users: data } = await response.json();

        // Debug log to see what we're getting from the API
        console.log("Search API response:", data);

        const mappedUsers = data
          .filter((user: ApiUser) => !excludeUserIds.includes(user.id))
          .map((user: ApiUser) => {
            // Log the raw user data from API
            console.log("Raw user from API:", user);
            
            const mappedUser = {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              imageUrl: user.imageUrl,
              avatarUrl: user.avatarUrl
            };
            console.log("Mapped user:", mappedUser);
            return mappedUser;
          });

        setUsers(mappedUsers);
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchValue, initialUsers, excludeUserIds]);

  const handleSelect = (user: User) => {
    onSelect({ type: 'user', userId: user.id, username: user.username });
    setSearchValue("");
    setShowDropdown(false);
  };

  const handleEmailSelect = () => {
    if (isValidEmail(searchValue)) {
      setShowEmailNote(true);
      setShowDropdown(false);
    }
  };

  const handleEmailInvite = () => {
    onSelect({ type: 'email', email: searchValue, note: emailNote || undefined });
    setSearchValue("");
    setEmailNote("");
    setShowEmailNote(false);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            // Delay hiding dropdown to allow click events to fire
            setTimeout(() => setShowDropdown(false), 200);
          }}
          disabled={disabled}
        />
        
        {showDropdown && (
          <div className="absolute w-full mt-1 py-1 bg-background rounded-md border shadow-md z-50">
            {(isLoading || isLoadingInitial) ? (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                Loading...
              </div>
            ) : (
              <>
                {users.length > 0 && (
                  <div className="py-1" role="group">
                    {users.map((user) => (
                      <div
                        key={`user-${user.id}`}
                        className={cn(
                          "flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent",
                          "transition-colors"
                        )}
                        onClick={() => handleSelect(user)}
                        role="option"
                        aria-selected={false}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatarUrl || user.imageUrl} alt={user.username} />
                          <AvatarFallback>
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {user.displayName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            @{user.username}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isValidEmail(searchValue) && (
                  <div
                    key="email-invite-option"
                    className={cn(
                      "flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-accent",
                      "transition-colors"
                    )}
                    onClick={handleEmailSelect}
                    role="option"
                    aria-selected={false}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Mail className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">
                        Invite by email
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {searchValue}
                      </span>
                    </div>
                  </div>
                )}
                {users.length === 0 && !isValidEmail(searchValue) && searchValue && (
                  <div key="no-results" className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No users found
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showEmailNote && (
        <div className="space-y-2">
          <Textarea
            placeholder="Add an optional note to include in the invitation email..."
            value={emailNote}
            onChange={(e) => setEmailNote(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowEmailNote(false);
                setSearchValue("");
                setEmailNote("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEmailInvite}>
              Send Invite
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 