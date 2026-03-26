import { useRef, useEffect, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, HighlightStyle, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import { dbmlLanguage } from './dbmlLanguage';

const dbmlDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd', fontWeight: 'bold' },      // Table, Ref, Enum — purple
  { tag: tags.atom, color: '#e5c07b' },                              // pk, not null, unique — gold
  { tag: tags.comment, color: '#7f848e', fontStyle: 'italic' },      // comments — gray
  { tag: tags.string, color: '#98c379' },                            // strings — green
  { tag: tags.number, color: '#d19a66' },                            // numbers — orange
  { tag: tags.typeName, color: '#56b6c2' },                          // types (INT, VARCHAR) — cyan
  { tag: tags.variableName, color: '#e06c75' },                      // identifiers — red/coral
  { tag: tags.operator, color: '#61afef' },                          // <, >, - — blue
  { tag: tags.bracket, color: '#e5c07b' },                           // brackets — gold
  { tag: tags.punctuation, color: '#abb2bf' },                       // punctuation — light gray
]);
import useStore from '../../store/useStore';

export default function DBMLEditor() {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const isExternalUpdate = useRef(false);
  const debounceTimer = useRef(null);

  const dbmlContent = useStore(s => s.dbmlContent);
  const darkMode = useStore(s => s.darkMode);
  const editMode = useStore(s => s.editMode);
  const setDbmlFromEditor = useStore(s => s.setDbmlFromEditor);

  const handleChange = useCallback(
    (content) => {
      if (isExternalUpdate.current) return;
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        setDbmlFromEditor(content);
      }, 300);
    },
    [setDbmlFromEditor]
  );

  // Create editor
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        handleChange(update.state.doc.toString());
      }
    });

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      syntaxHighlighting(darkMode ? dbmlDarkHighlight : defaultHighlightStyle),
      dbmlLanguage,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      updateListener,
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
      EditorState.readOnly.of(!editMode),
    ];

    if (darkMode) {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: dbmlContent,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, editMode]);

  // Sync external content changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== dbmlContent) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: dbmlContent,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [dbmlContent]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 uppercase tracking-wider">
        DBML Editor
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
}
