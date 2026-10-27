import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ClubeVariantBHero, { preserveClubBAdParams } from './ClubeVariantBHero';
afterEach(cleanup);

describe('exclusive B hero', () => {
  it('shows the annual promise, offer and benefits, and uses the supplied purchase callback', () => {
    const buy = vi.fn();
    render(<ClubeVariantBHero price={87} loading={false} onSubscribe={buy} />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('por R$ 87 o ano');
    expect(screen.getByText('R$ 97').tagName).toBe('DEL');
    expect(screen.getByText('Desconto de lançamento')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Quero entrar p/ o Clube' }));
    expect(buy).toHaveBeenCalledTimes(1);
  });
  it('does not offer an expired discount or enable purchase while loading', () => {
    const buy = vi.fn();
    render(<ClubeVariantBHero price={197} loading onSubscribe={buy} />);
    expect(screen.queryByText('R$ 97')).toBeNull();
    expect(screen.queryByText('Desconto de lançamento')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(buy).not.toHaveBeenCalled();
  });
  it('keeps advertising parameters without overwriting checkout offer or copying unrelated values', () => {
    const url = new URL(preserveClubBAdParams('/checkout/club/clube-anual?oferta=publica', '?utm_source=meta&utm_campaign=clube&utm_content=criativo+1&fbclid=abc%2B123&oferta=outra&email=privado'), 'https://drinkeros.com');
    expect(url.searchParams.get('oferta')).toBe('publica');
    expect(url.searchParams.get('utm_source')).toBe('meta');
    expect(url.searchParams.get('utm_campaign')).toBe('clube');
    expect(url.searchParams.get('utm_content')).toBe('criativo 1');
    expect(url.searchParams.get('fbclid')).toBe('abc+123');
    expect(url.searchParams.has('email')).toBe(false);
    expect(preserveClubBAdParams('/checkout/club/clube-anual', '')).toBe('/checkout/club/clube-anual');
  });
});
