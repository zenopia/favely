'use client'

import dynamic from 'next/dynamic'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import BubbleMenu from '@tiptap/extension-bubble-menu'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ListOrdered, List, IndentIcon, OutdentIcon } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { TextSelection } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { ListItemExtension } from './list-item-extension'
import { SubListItemExtension } from './sub-list-item-extension'
import './tiptap-editor.css'

export type ListType = 'ordered' | 'bullet' | 'task'

interface TiptapEditorProps {
  content?: string
  onChange?: (content: string) => void
  onListTypeChange?: (type: ListType) => void
  defaultListType?: ListType
  className?: string
  editable?: boolean
  placeholder?: string
  category?: string
}

function TiptapEditorComponent({
  content = '',
  onChange,
  onListTypeChange,
  defaultListType = 'ordered',
  className,
  editable = true,
  placeholder = 'Start typing...',
  category,
}: TiptapEditorProps) {
  const [currentListType, setCurrentListType] = useState<ListType>(defaultListType)
  const [isDragging, setIsDragging] = useState(false)
  const initialCategoryRef = useRef(category)
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)

  const handleKeyDown = (view: EditorView, event: KeyboardEvent): boolean => {
    if (!editorRef.current) return false
    
    const { state } = view
    const { selection } = state
    const { $from } = selection
    const pos = $from.before()
    const node = state.doc.nodeAt(pos)

    // Handle Tab key for indentation
    if (event.key === 'Tab') {
      event.preventDefault()
      
      if (!event.shiftKey) {
        // Check if we're already in a nested list
        const grandParent = $from.node(-3)
        const isInNestedList = grandParent && grandParent.type.name === 'listItem'
        
        if (isInNestedList) {
          // Already nested, don't allow further nesting
          return true
        }

        if (node && node.type.name === 'listItem') {
          // Convert directly to sub-list item
          const tr = state.tr
          const subListItem = state.schema.nodes.subListItem.create(
            { 
              category: initialCategoryRef.current,
              depth: 0
            },
            node.content
          )

          tr.replaceWith(pos, pos + node.nodeSize, subListItem)
          editorRef.current.view.dispatch(tr)
          return true
        }
      } else {
        // Handle outdenting
        if (node && node.type.name === 'subListItem') {
          // Convert back to regular list item
          const tr = state.tr
          const listItem = state.schema.nodes.listItem.create(
            {},
            node.content
          )

          tr.replaceWith(pos, pos + node.nodeSize, listItem)
          editorRef.current.view.dispatch(tr)
          return true
        } else {
          return editorRef.current.commands.liftListItem()
        }
      }
    }

    return false
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        heading: false,
        blockquote: false,
        codeBlock: false,
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
          itemTypeName: 'listItem',
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
          itemTypeName: 'listItem',
        },
        listItem: false,
      }),
      ListItemExtension.configure({
        nested: true,
        HTMLAttributes: {
          category: initialCategoryRef.current,
        },
      }),
      SubListItemExtension.configure({
        HTMLAttributes: {
          category: initialCategoryRef.current,
        },
      }),
      BubbleMenu.configure({
        pluginKey: 'tagBubbleMenu',
        shouldShow: () => false,
      }),
    ],
    content,
    editable,
    onCreate: ({ editor }) => {
      editorRef.current = editor

      // Set initial content
      if (!content) {
        editor
          .chain()
          .setContent(`<ol><li>${placeholder}</li></ol>`)
          .focus()
          .run()
      } else {
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

      if (defaultListType === 'bullet') {
        editor.chain().toggleBulletList().run()
      }
      setCurrentListType(defaultListType)

      // Set initial category
      if (initialCategoryRef.current) {
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem' || node.type.name === 'subListItem') {
            editor.commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                category: initialCategoryRef.current
              })
              return true
            })
          }
        })
      }
    },
    onDestroy: () => {
      editorRef.current = null
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML())
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
          className
        ),
      },
      handleKeyDown,
    },
  })

  // Only update category when it changes
  useEffect(() => {
    if (editorRef.current && category !== initialCategoryRef.current) {
      initialCategoryRef.current = category
      editorRef.current.state.doc.descendants((node, pos) => {
        if (node.type.name === 'listItem' || node.type.name === 'subListItem') {
          editorRef.current?.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              category
            })
            return true
          })
        }
      })
    }
  }, [category])

  const handleIndent = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!editor) return
    
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    const pos = $from.before()
    const node = state.doc.nodeAt(pos)
    const parentList = $from.node(-2)
    const isInList = parentList && (parentList.type.name === 'bulletList' || parentList.type.name === 'orderedList')
    
    if (!isInList || !node) return

    // Check if we're already in a nested list
    const grandParent = $from.node(-3)
    const isInNestedList = grandParent && grandParent.type.name === 'listItem'
    
    if (isInNestedList) {
      // Already nested, don't allow further nesting
      return
    }

    if (node.type.name === 'listItem') {
      // Convert directly to sub-list item
      const tr = state.tr
      const subListItem = state.schema.nodes.subListItem.create(
        { 
          category: initialCategoryRef.current,
          depth: 0
        },
        node.content
      )

      tr.replaceWith(pos, pos + node.nodeSize, subListItem)
      editor.view.dispatch(tr)
    }
  }

  const handleOutdent = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!editor) return
    
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    const pos = $from.before()
    const node = state.doc.nodeAt(pos)

    if (node && node.type.name === 'subListItem') {
      // Convert back to regular list item
      const tr = state.tr
      const listItem = state.schema.nodes.listItem.create(
        {},
        node.content
      )

      tr.replaceWith(pos, pos + node.nodeSize, listItem)
      editor.view.dispatch(tr)
    } else {
      editor.commands.liftListItem()
    }
  }

  const handleListTypeChange = (type: ListType) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (!editor) return
    
    // Get the current selection and find the list we need to toggle
    const { state } = editor
    const { selection } = state
    const $from = selection.$from
    let depth = $from.depth
    let foundList = false
    
    // Find the closest list node
    while (depth > 0) {
      const node = $from.node(depth)
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
        foundList = true
        break
      }
      depth--
    }
    
    if (foundList) {
      // We're in a list, so toggle it
      if (type === 'bullet') {
        editor.chain().toggleBulletList().run()
      } else {
        editor.chain().toggleOrderedList().run()
      }
    } else {
      // Not in a list, create a new one
      setCurrentListType(type)
      if (onListTypeChange) {
        onListTypeChange(type)
      }

      if (editor.isEmpty) {
        editor.chain().setContent(`<li><p>${placeholder}</p></li>`).focus().run()
      }
      
      if (type === 'bullet') {
        editor.chain().toggleBulletList().run()
      } else {
        editor.chain().toggleOrderedList().run()
      }
    }
  }

  const isListType = (type: ListType): boolean => {
    if (!editor) return type === currentListType
    
    // Get the current node's parent list type
    const { state } = editor
    const { selection } = state
    const $from = selection.$from
    let depth = $from.depth
    
    // Find the closest parent list
    while (depth > 0) {
      const node = $from.node(depth)
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
        return type === 'bullet' ? node.type.name === 'bulletList' : node.type.name === 'orderedList'
      }
      depth--
    }
    
    return type === currentListType
  }

  const getListTag = (type: ListType) => {
    switch (type) {
      case 'bullet':
        return 'ul'
      case 'ordered':
        return 'ol'
      default:
        return 'ol'
    }
  }

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleListTypeChange('ordered')}
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
          onClick={handleListTypeChange('bullet')}
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
      <EditorContent editor={editor} />
    </div>
  )
}

// Create a client-only wrapper component
function ClientOnlyTiptapEditor(props: TiptapEditorProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return <TiptapEditorComponent {...props} />
}

// Export the client-only version
export const TiptapEditor = ClientOnlyTiptapEditor 