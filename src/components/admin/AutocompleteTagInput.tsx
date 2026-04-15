import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';

interface AutocompleteTagInputProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  suggestions: string[];
  existingTags: string[];
  placeholder?: string;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onBlurExtra?: () => void;
}

const AutocompleteTagInput: React.FC<AutocompleteTagInputProps> = ({
  value,
  onChange,
  onAdd,
  onKeyDown,
  suggestions,
  existingTags,
  placeholder,
  className,
  inputRef,
  onBlurExtra,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim().length > 0
    ? suggestions.filter(
        (s) =>
          s.toLowerCase().includes(value.toLowerCase()) &&
          !existingTags.includes(s)
      )
    : [];

  useEffect(() => {
    setSelectedIndex(-1);
    setShowSuggestions(filtered.length > 0);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (tag: string) => {
    onAdd(tag);
    onChange('');
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && selectedIndex >= 0) {
        e.preventDefault();
        selectSuggestion(filtered[selectedIndex]);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (filtered.length > 0) setShowSuggestions(true); }}
        onBlur={() => {
          setTimeout(() => setShowSuggestions(false), 150);
          if (value.trim()) {
            onAdd(value.trim());
            onChange('');
          }
        }}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.slice(0, 8).map((tag, i) => (
            <button
              key={tag}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors ${
                i === selectedIndex ? 'bg-accent' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(tag);
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteTagInput;
