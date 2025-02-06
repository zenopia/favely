import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ListOrdered, List } from 'lucide-react'
import { useState } from 'react'
import { TextSelection } from 'prosemirror-state'
import './tiptap-editor.css'

interface TiptapEditorProps {
  content?: string
  onChange?: (content: string) => void
  onListTypeChange?: (type: ListType) => void
  defaultListType?: ListType
  className?: string
  editable?: boolean
  placeholder?: string
}

export type ListType = 'ordered' | 'bullet' | 'task'

export function TiptapEditor({
  content = '',
  onChange,
  onListTypeChange,
  defaultListType = 'ordered',
  className,
  editable = true,
  placeholder = 'Start typing...',
}: TiptapEditorProps) {
  const [currentListType, setCurrentListType] = useState<ListType>(defaultListType)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep paragraph but disable other block nodes
        horizontalRule: false,
        heading: false,
        blockquote: false,
        codeBlock: false,
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
    ],
    content,
    editable,
    immediatelyRender: false,
    onCreate: ({ editor }) => {
      if (!content) {
        // For new content, create an empty list
        editor
          .chain()
          .setContent(`<ol><li>${placeholder}</li></ol>`)
          .focus()
          .run()
      } else {
        // For existing content, ensure it's in a list
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = content
        const items = Array.from(tempDiv.querySelectorAll('li'))
        const itemsHtml = items
          .map(item => `<li>${item.textContent || placeholder}</li>`)
          .join('')
        
        editor
          .chain()
          .setContent(`<ol>${itemsHtml}</ol>`)
          .run()
      }

      // Set the list type based on defaultListType
      if (defaultListType === 'bullet') {
        editor.chain().toggleBulletList().run()
      }
      setCurrentListType(defaultListType)
    },
    onUpdate: ({ editor }) => {
      // Check if editor is completely empty (no list structure)
      if (editor.isEmpty) {
        editor
          .chain()
          .setContent(`<${getListTag(currentListType)}><li><p>${placeholder}</p></li></${getListTag(currentListType)}>`)
          .focus()
          .run()
      }

      // Only call onChange if we have a handler
      if (onChange) {
        onChange(editor.getHTML())
      }
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert focus:outline-none max-w-none',
        'data-placeholder': placeholder,
      },
      handleKeyDown: (view, event) => {
        const { state } = view
        const { selection } = state
        const { empty, $head } = selection

        // Handle Enter key
        if (event.key === 'Enter' && !event.shiftKey) {
          // If we're in an empty list item
          if (empty && $head.parent.textContent === '') {
            return true // Prevent default behavior (lifting out of list)
          }
        }

        // Handle Backspace key
        if (event.key === 'Backspace' && empty) {
          // If we're at the start of a list item
          if ($head.parentOffset === 0) {
            const listNode = $head.node(-2) // Get the parent list node
            const listItemNode = $head.node(-1) // Get the current list item node
            const listItemPos = $head.before(-1) // Get position before current list item
            const isFirstItem = $head.index(-2) === 0 // Check if this is the first item
            
            // If this is the last item in the list and it's empty
            if (listNode.childCount === 1 && listItemNode.textContent === '') {
              return true // Prevent deletion to keep at least one item
            }

            // If this is the first item, prevent exiting list format
            if (isFirstItem) {
              return true
            }

            // If we're not the first item and we're empty
            if (listItemPos > 0 && listItemNode.textContent === '') {
              // Delete current item and move to end of previous item
              const tr = state.tr.delete(listItemPos, listItemPos + listItemNode.nodeSize)
              const prevNode = $head.node(-2).child($head.index(-2) - 1)
              const prevPos = listItemPos - prevNode.nodeSize
              tr.setSelection(TextSelection.create(tr.doc, prevPos + prevNode.nodeSize - 2))
              view.dispatch(tr)
              return true
            }
          }
        }

        // Prevent exiting list format with Enter+Shift
        if (event.key === 'Enter' && event.shiftKey) {
          return true
        }

        return false
      },
    },
    autofocus: 'end',
  })

  const setListType = (type: ListType) => {
    if (!editor) return
    
    // Don't do anything if trying to toggle the current type
    if (type === 'bullet' && editor.isActive('bulletList')) return
    if (type === 'ordered' && editor.isActive('orderedList')) return
    
    setCurrentListType(type)
    if (onListTypeChange) {
      onListTypeChange(type)
    }

    // First ensure we're in a list
    if (editor.isEmpty) {
      editor.chain().setContent(`<li>${placeholder}</li>`).focus().run()
    }
    
    // Toggle the appropriate list type
    if (type === 'bullet') {
      editor.chain().toggleBulletList().run()
    } else {
      editor.chain().toggleOrderedList().run()
    }
  }

  const isListType = (type: ListType): boolean => {
    if (!editor) return type === currentListType
    return type === 'bullet' 
      ? editor.isActive('bulletList')
      : editor.isActive('orderedList')
  }

  const getListTag = (type: ListType) => {
    switch (type) {
      case 'bullet':
        return 'ul';
      case 'ordered':
      case 'task':
        return 'ol';
      default:
        return 'ol';
    }
  }

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="flex items-center gap-1 pb-2 border-b">
        <Button
          variant={isListType('ordered') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setListType('ordered' as ListType)}
          type="button"
          className="gap-2"
        >
          <ListOrdered className="h-4 w-4" />
          <span className="hidden sm:inline">Numbered</span>
        </Button>
        <Button
          variant={isListType('bullet') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setListType('bullet' as ListType)}
          type="button"
          className="gap-2"
        >
          <List className="h-4 w-4" />
          <span className="hidden sm:inline">Bullet</span>
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
} 