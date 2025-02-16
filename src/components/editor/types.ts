import { Editor } from '@tiptap/react'

export type ListType = 'ordered' | 'bullet' | 'task'

export interface TiptapEditorProps {
  content?: string
  onChange?: (content: string) => void
  onListTypeChange?: (type: ListType) => void
  onCompletedChange?: (completed: boolean, nodeId: string) => void
  defaultListType?: ListType
  className?: string
  editable?: boolean
  placeholder?: string
  category?: string
}

export interface EditorToolbarProps {
  editor: Editor | null
  onListTypeChange: (type: ListType) => (e: React.MouseEvent) => void
  isListType: (type: ListType) => boolean
  handleIndent: (e: React.MouseEvent) => void
  handleOutdent: (e: React.MouseEvent) => void
} 