import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Plus } from 'lucide-react';
import AutocompleteTagInput from '@/components/admin/AutocompleteTagInput';

interface InlineTagEditorProps {
  tags: string[];
  onSave: (tags: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

const InlineTagEditor: React.FC<InlineTagEditorProps> = ({ tags, onSave, placeholder = 'Adicionar...', suggestions = [] }) => {
  const [editing, setEditing] = useState(false);
  const [localTags, setLocalTags] = useState<string[]>(tags);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setLocalTags(tags);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [editing, tags]);

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !localTags.includes(trimmed)) {
      const updated = [...localTags, trimmed];
      setLocalTags(updated);
      onSave(updated);
    }
    setInput('');
  };

  const removeTag = (index: number) => {
    const updated = localTags.filter((_, i) => i !== index);
    setLocalTags(updated);
    onSave(updated);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-1 cursor-pointer min-w-[80px]" onClick={() => setEditing(true)}>
        {tags.length > 0 ? (
          tags.map((tag, i) => (
            <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
          ))
        ) : (
          <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1 px-2">
            <Plus className="h-3 w-3" />
            Adicionar tag
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1">
        {localTags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-0.5 pr-1">
            {tag}
            <button type="button" onClick={() => removeTag(i)} className="ml-0.5 hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <AutocompleteTagInput
        inputRef={inputRef}
        value={input}
        onChange={setInput}
        onAdd={(v) => addTag(v)}
        onKeyDown={(e) => {
          handleKeyDown(e);
        }}
        suggestions={suggestions}
        existingTags={localTags}
        placeholder={placeholder}
        className="h-7 text-xs"
        onBlurExtra={() => setEditing(false)}
      />
    </div>
  );
};

export default InlineTagEditor;
