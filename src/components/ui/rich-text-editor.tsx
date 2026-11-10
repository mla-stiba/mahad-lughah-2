'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link as LinkIcon, Undo, Redo } from 'lucide-react'

// ============ RICH TEXT EDITOR (FIX #7) ============
// Pakai TipTap (headless editor) — support bold/italic/underline, alignment,
// bullet list, link, undo/redo. Save sebagai HTML string.
// Lightweight: ~80KB bundle (vs react-quill ~200KB)
// Sumber: https://tiptap.dev/

interface RichTextEditorProps {
  value: string  // HTML string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

export function RichTextEditor({ value, onChange, placeholder = 'Tulis di sini...', className = '', minHeight = 120 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,  // includes bold, italic, list, dll
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-emerald-600 underline' },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none px-3 py-2 ${className}`,
        style: `min-height: ${minHeight}px;`,
        'data-placeholder': placeholder,
      },
    },
    // Pastikan content di-update kalau value berubah dari luar (mis. load soal existing)
    immediatelyRender: false,
  })

  // Sync external value → editor (kalau value berubah dari luar, mis. setelah load data)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  if (!editor) {
    return <div className="border rounded-xl p-3 text-gray-400 text-sm">Loading editor...</div>
  }

  const ToolbarButton = ({ onClick, active, title, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-gray-100 transition ${
        active ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Rata Kiri">
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Rata Tengah">
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Rata Kanan">
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => {
            const url = window.prompt('Masukkan URL link:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive('link')}
          title="Insert Link"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-300 mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Placeholder fallback (kalau editor kosong) */}
      {editor.isEmpty && (
        <div className="px-3 py-2 text-xs text-gray-400 -mt-8 pointer-events-none">
          {placeholder}
        </div>
      )}
    </div>
  )
}
