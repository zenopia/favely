import StarterKit from '@tiptap/starter-kit'
import BubbleMenu from '@tiptap/extension-bubble-menu'
import { ListItemExtension } from './list-item-extension'
import { SubListItemExtension } from './sub-list-item-extension'
import { Editor } from '@tiptap/react'
import { ListType } from './types'

export const createEditorExtensions = (category: string | undefined) => [
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
      category,
    },
  }),
  SubListItemExtension.configure({
    HTMLAttributes: {
      category,
    },
  }),
  BubbleMenu.configure({
    pluginKey: 'tagBubbleMenu',
    shouldShow: () => false,
  }),
]

export const initializeEditorContent = (editor: Editor, content: string | undefined, placeholder: string, defaultListType: ListType) => {
  if (!content) {
    editor
      .chain()
      .setContent(`<ol><li>${placeholder}</li></ol>`)
      .focus()
      .run()
  } else {
    editor
      .chain()
      .setContent(content)
      .run()
  }

  if (defaultListType === 'bullet') {
    editor.chain().toggleBulletList().run()
  }
} 