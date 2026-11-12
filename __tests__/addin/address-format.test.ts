import { splitAddressLines } from '../../lib/address-format';

describe('splitting imported address lines at commas', () => {
  it('gives 0406 six lines, one per comma-separated part, keeping the source spelling', () => {
    expect(splitAddressLines(['The Dock,', 'Station road, Kings Langley', 'Hertfordshire', 'WD4 8LZ', 'United Kingdom'])).toEqual([
      'The Dock',
      'Station road',
      'Kings Langley',
      'Hertfordshire',
      'WD4 8LZ',
      'United Kingdom',
    ]);
  });

  it('drops trailing commas, empty parts and blank lines', () => {
    expect(splitAddressLines(['1 High St,, ', ' , ', '', 'Town ,', ',Postcode'])).toEqual(['1 High St', 'Town', 'Postcode']);
  });

  it('keeps every part when there are more than six', () => {
    const lines = splitAddressLines(['Unit 4, Block B, Dock Yard', 'Station road, Kings Langley', 'Hertfordshire, WD4 8LZ, United Kingdom']);
    expect(lines).toHaveLength(8);
    expect(lines[7]).toBe('United Kingdom');
  });
});
