import dynamic from 'next/dynamic'

export const TiptapEditor = dynamic(
  () => import('./tiptap-editor').then((mod) => mod.TiptapEditor),
  {
    ssr: false,
  }
) 