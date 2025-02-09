import { Editor } from '@tiptap/react'
import { useCallback } from 'react'
import { ListType } from './types'

export const useListManagement = (editor: Editor | null, currentListType: ListType, onListTypeChange?: (type: ListType) => void) => {
  const handleIndent = useCallback((e: React.MouseEvent) => {
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
          category: node.attrs.category,
          depth: 0
        },
        node.content
      )

      tr.replaceWith(pos, pos + node.nodeSize, subListItem)
      editor.view.dispatch(tr)
    }
  }, [editor])

  const handleOutdent = useCallback((e: React.MouseEvent) => {
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
  }, [editor])

  const handleListTypeChange = useCallback((type: ListType) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (!editor) return
    
    const { state } = editor
    const { selection } = state
    const $from = selection.$from
    let depth = $from.depth
    let foundList = false
    
    while (depth > 0) {
      const node = $from.node(depth)
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
        foundList = true
        break
      }
      depth--
    }
    
    if (foundList) {
      if (type === 'bullet') {
        editor.chain().toggleBulletList().run()
      } else {
        editor.chain().toggleOrderedList().run()
      }
    } else {
      if (onListTypeChange) {
        onListTypeChange(type)
      }

      if (editor.isEmpty) {
        editor.chain().setContent('<li><p>Start typing...</p></li>').focus().run()
      }
      
      if (type === 'bullet') {
        editor.chain().toggleBulletList().run()
      } else {
        editor.chain().toggleOrderedList().run()
      }
    }
  }, [editor, onListTypeChange])

  const isListType = useCallback((type: ListType): boolean => {
    if (!editor) return type === currentListType
    
    const { state } = editor
    const { selection } = state
    const $from = selection.$from
    let depth = $from.depth
    
    while (depth > 0) {
      const node = $from.node(depth)
      if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
        return type === 'bullet' ? node.type.name === 'bulletList' : node.type.name === 'orderedList'
      }
      depth--
    }
    
    return type === currentListType
  }, [editor, currentListType])

  return {
    handleIndent,
    handleOutdent,
    handleListTypeChange,
    isListType,
  }
} 