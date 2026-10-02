import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ScrapedHtml from './ScrapedHtml';

describe('ScrapedHtml', () => {
  it('renders the HTML in a styled div, and an empty div for undefined', () => {
    const { container } = render(<ScrapedHtml html="<b>x</b><br>y" style={{ color: 'red' }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.style.color).toBe('red');
    expect(root.querySelector('b')?.textContent).toBe('x');
    expect(root.querySelector('br')).not.toBeNull();
    expect(root.innerHTML).toBe('<b>x</b><br>y');

    const { container: empty } = render(<ScrapedHtml html={undefined} />);
    expect(empty.firstElementChild?.innerHTML).toBe('');
  });
});
