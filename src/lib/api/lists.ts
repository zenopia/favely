import { CollaboratorRole } from '@/types/list';

// Collaborator Management
export async function getListCollaborators(listId: string) {
  const response = await fetch(`/api/lists/${listId}/collaborators`);
  if (!response.ok) {
    throw new Error('Failed to fetch collaborators');
  }
  return response.json();
}

export async function addListCollaborator(listId: string, email: string, role: CollaboratorRole = 'viewer') {
  const response = await fetch(`/api/lists/${listId}/collaborators`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, role }),
  });
  if (!response.ok) {
    throw new Error('Failed to add collaborator');
  }
  return response.json();
}

export async function updateCollaboratorRole(listId: string, collaboratorId: string, role: CollaboratorRole) {
  const response = await fetch(`/api/lists/${listId}/collaborators`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collaboratorId, role }),
  });
  if (!response.ok) {
    throw new Error('Failed to update collaborator role');
  }
  return response.json();
}

export async function removeListCollaborator(listId: string, collaboratorId: string) {
  const response = await fetch(`/api/lists/${listId}/collaborators`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collaboratorId }),
  });
  if (!response.ok) {
    throw new Error('Failed to remove collaborator');
  }
  return response.json();
}

// Update list visibility
export async function updateListVisibility(listId: string, visibility: 'public' | 'private' | 'unlisted') {
  const response = await fetch(`/api/lists/${listId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ visibility }),
  });
  if (!response.ok) {
    throw new Error('Failed to update list visibility');
  }
  return response.json();
} 