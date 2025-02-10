import { Button } from '@/components/ui/button'
import { ListOrdered, List, IndentIcon, OutdentIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditorToolbarProps } from './types'

export function EditorToolbar({
  editor,
  onListTypeChange,
  isListType,
  handleIndent,
  handleOutdent,
}: EditorToolbarProps) {
  if (!editor) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onListTypeChange('ordered')}
        className={cn(
          'hover:bg-muted',
          isListType('ordered') && 'bg-muted'
        )}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onListTypeChange('bullet')}
        className={cn(
          'hover:bg-muted',
          isListType('bullet') && 'bg-muted'
        )}
      >
        <List className="h-4 w-4" />
      </Button>
      <div className="w-px h-4 bg-muted mx-2" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleIndent}
        title="Indent (Tab)"
        className="hover:bg-muted"
      >
        <IndentIcon className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleOutdent}
        title="Outdent (Shift+Tab)"
        className="hover:bg-muted"
      >
        <OutdentIcon className="h-4 w-4" />
      </Button>
    </div>
  )
} 