import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import SubListItemView from './sub-list-item-view'

export interface SubListItemAttributes {
  active?: boolean
  dragging?: boolean
  tag?: string
  depth?: number
  category?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subListItem: {
      /**
       * Set a tag for the sub-list item
       */
      setSubListItemTag: (tag: string) => ReturnType
      /**
       * Set the depth of the sub-list item
       */
      setSubListItemDepth: (depth: number) => ReturnType
      /**
       * Set the category for the sub-list item
       */
      setSubListItemCategory: (category: string) => ReturnType
    }
  }
}

export const SubListItemExtension = Node.create({
  name: 'subListItem',

  addOptions() {
    return {
      HTMLAttributes: {},
      nested: true,
    }
  },

  group: 'listItem',

  content: 'paragraph block*',

  defining: true,

  draggable: true,

  addStorage() {
    return {
      activeItemPos: null as number | null,
    }
  },

  addAttributes() {
    return {
      active: {
        default: false,
        renderHTML: attributes => {
          if (!attributes.active) {
            return {}
          }
          return { 'data-active': '' }
        },
      },
      dragging: {
        default: false,
        renderHTML: attributes => {
          if (!attributes.dragging) {
            return {}
          }
          return { 'data-dragging': '' }
        },
      },
      tag: {
        default: null,
        parseHTML: element => element.getAttribute('data-tag'),
        renderHTML: attributes => {
          if (!attributes.tag) {
            return {}
          }
          return { 'data-tag': attributes.tag }
        },
      },
      depth: {
        default: 0,
        parseHTML: element => parseInt(element.getAttribute('data-depth') || '0'),
        renderHTML: attributes => {
          return { 'data-depth': attributes.depth }
        },
      },
      category: {
        default: null,
        parseHTML: element => element.getAttribute('data-category'),
        renderHTML: attributes => {
          if (!attributes.category) {
            return {}
          }
          return { 'data-category': attributes.category }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'li[data-type="sub-list-item"]',
        priority: 51,
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['li', mergeAttributes(
      this.options.HTMLAttributes,
      { 'data-type': 'sub-list-item' },
      HTMLAttributes
    ), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubListItemView)
  },

  addCommands() {
    return {
      setSubListItemTag:
        (tag: string) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const position = selection.$anchor.pos
          const node = state.doc.nodeAt(position)
          
          if (!node || node.type.name !== 'subListItem') return false
          
          if (dispatch) {
            tr.setNodeMarkup(position, undefined, {
              ...node.attrs,
              tag,
            })
            return dispatch(tr)
          }
          
          return true
        },

      setSubListItemDepth:
        (depth: number) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const position = selection.$anchor.pos
          const node = state.doc.nodeAt(position)
          
          if (!node || node.type.name !== 'subListItem') return false
          
          if (dispatch) {
            tr.setNodeMarkup(position, undefined, {
              ...node.attrs,
              depth,
            })
            return dispatch(tr)
          }
          
          return true
        },

      setSubListItemCategory:
        (category: string) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const position = selection.$anchor.pos
          const node = state.doc.nodeAt(position)
          
          if (!node || node.type.name !== 'subListItem') return false
          
          if (dispatch) {
            tr.setNodeMarkup(position, undefined, {
              ...node.attrs,
              category,
            })
            return dispatch(tr)
          }
          
          return true
        },
    }
  },
}) 