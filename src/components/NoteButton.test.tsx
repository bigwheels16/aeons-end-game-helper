import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import NoteButton from './NoteButton';
import { useGameStore } from '../store';

const bramaNote = () => useGameStore.getState().notes.mages['mage:brama'];
const iconFill = (button: HTMLElement) => button.querySelector('path')?.getAttribute('fill');

describe('NoteButton', () => {
  beforeEach(() => {
    useGameStore.setState({ notes: { supply: {}, mages: {}, nemeses: {} } });
  });

  it('adds a trimmed note and fills the icon; Save stays disabled while the text is blank', () => {
    render(<NoteButton category="mages" id="mage:brama" name="Brama" />);
    const button = screen.getByRole('button', { name: 'Add note on Brama' });
    expect(iconFill(button)).toBe('none');
    expect(button.getAttribute('title')).toBe('Add note');

    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Note on Brama' })).toBeTruthy();
    const box = screen.getByRole('textbox', { name: 'Note' });
    expect(document.activeElement).toBe(box);
    const save = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();

    fireEvent.change(box, { target: { value: '   ' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(box, { target: { value: '  Good opener.\nPair with Jian.  ' } });
    fireEvent.click(save);

    expect(bramaNote()).toBe('Good opener.\nPair with Jian.');
    expect(screen.queryByRole('dialog')).toBeNull();
    const filled = screen.getByRole('button', { name: 'Edit note on Brama' });
    expect(iconFill(filled)).toBe('#64b5f6');
    expect(filled.getAttribute('title')).toBe('Good opener.\nPair with Jian.');
    expect(document.activeElement).toBe(filled);
  });

  it('edits the existing note, opening with the heading focused', () => {
    useGameStore.getState().setNote('mages', 'mage:brama', 'Old text');
    render(<NoteButton category="mages" id="mage:brama" name="Brama" />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit note on Brama' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Note on Brama' }));
    const box = screen.getByRole('textbox', { name: 'Note' }) as HTMLTextAreaElement;
    expect(box.value).toBe('Old text');
    fireEvent.change(box, { target: { value: 'New text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(bramaNote()).toBe('New text');
  });

  it('Cancel and Escape close without saving', () => {
    useGameStore.getState().setNote('mages', 'mage:brama', 'Keep me');
    render(<NoteButton category="mages" id="mage:brama" name="Brama" />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit note on Brama' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Edit note on Brama' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'Draft' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    expect(bramaNote()).toBe('Keep me');
  });

  it('Delete asks for a second tap, then removes the note and empties the icon', () => {
    useGameStore.getState().setNote('mages', 'mage:brama', 'Remove me');
    render(<NoteButton category="mages" id="mage:brama" name="Brama" />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit note on Brama' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(bramaNote()).toBe('Remove me');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));
    expect(bramaNote()).toBeUndefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(iconFill(screen.getByRole('button', { name: 'Add note on Brama' }))).toBe('none');
  });

  it('keeps notes separate per item and category', () => {
    useGameStore.getState().setNote('supply', 'supply:jade', 'Jade note');
    render(<NoteButton category="mages" id="mage:brama" name="Brama" />);
    expect(screen.getByRole('button', { name: 'Add note on Brama' })).toBeTruthy();
  });
});
