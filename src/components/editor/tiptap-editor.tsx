'use client'

export type { ListType } from './types'

import { useEditor, EditorContent } from '@tiptap/react'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { EditorView } from 'prosemirror-view'
import { TiptapEditorProps, ListType } from './types'
import { createEditorExtensions, initializeEditorContent } from './editor-config'
import { useListManagement } from './use-list-management'
import { EditorToolbar } from './editor-toolbar'
import './tiptap-editor.css'

function TiptapEditorComponent({
  content = '',
  onChange,
  onListTypeChange,
  defaultListType = 'ordered',
  className,
  editable = true,
  placeholder = 'Start typing...',
  category,
  onCompletedChange,
}: TiptapEditorProps) {
  const [currentListType, setCurrentListType] = useState<ListType>(defaultListType)
  const initialCategoryRef = useRef(category)

  const handleKeyDown = (view: EditorView, event: KeyboardEvent): boolean => {
    if (!editor) return false
    
    if (event.key === 'Tab') {
      event.preventDefault()
      
      if (!event.shiftKey) {
        return editor.commands.sinkListItem()
      } else {
        return editor.commands.liftListItem()
      }
    }

    return false
  }

  const editor = useEditor({
    extensions: createEditorExtensions(initialCategoryRef.current),
    content,
    editable,
    immediatelyRender: false,
    onCompletedChange,
    onCreate: ({ editor }) => {
      initializeEditorContent(editor, content, placeholder, defaultListType)
      setCurrentListType(defaultListType)

      // Set initial category
      if (initialCategoryRef.current) {
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'listItem') {
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

  // Update category when it changes
  useEffect(() => {
    if (editor && category !== initialCategoryRef.current) {
      initialCategoryRef.current = category
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'listItem') {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              category
            })
            return true
          })
        }
      })
    }
  }, [category, editor])

  const {
    handleListTypeChange,
    isListType,
    handleIndent,
    handleOutdent,
  } = useListManagement(editor, currentListType, (type) => {
    setCurrentListType(type)
    if (onListTypeChange) {
      onListTypeChange(type)
    }
  })

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <EditorToolbar
        editor={editor}
        onListTypeChange={handleListTypeChange}
        isListType={isListType}
        handleIndent={handleIndent}
        handleOutdent={handleOutdent}
      />
      <EditorContent editor={editor} className="w-full" />
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