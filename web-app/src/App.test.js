import { render, screen } from '@testing-library/react';
import ShoppingList from './components/ShoppingList';

jest.mock('./services/kvService', () => ({
  __esModule: true,
  default: {
    get: async (_userId, key) =>
      key === 'currentShoppingList'
        ? {
            generatedAt: 'now',
            totalCost: 9.31,
            weeklyBudget: 50,
            shoppingList: {
              sections: [
                {
                  category: 'Produce',
                  items: [
                    { name: 'Bananas', quantity: 3, unit: 'lb', estimatedPrice: 1.74, searchTerm: 'bananas' },
                    { name: 'Chicken Thighs Family Pack', quantity: 2, unit: '4.7 lb pack', estimatedPrice: 7.57 },
                  ],
                },
              ],
            },
          }
        : null,
    set: async () => true,
    delete: async () => true,
  },
}));

test('shopping list shows items, the total and a Walmart link for each item', async () => {
  render(<ShoppingList user={{ id: 'user_1' }} />);
  expect(await screen.findByText('Estimated total: $9.31')).toBeInTheDocument();
  expect(screen.getByText('3 lb Bananas')).toBeInTheDocument();
  expect(screen.getByText('2 × Chicken Thighs Family Pack (4.7 lb pack)')).toBeInTheDocument();
  const links = screen.getAllByRole('link', { name: 'Find' });
  expect(links[0]).toHaveAttribute('href', 'https://www.walmart.com/search?q=bananas');
  expect(links[1]).toHaveAttribute('href', 'https://www.walmart.com/search?q=Chicken%20Thighs%20Family%20Pack');
  expect(screen.getByRole('button', { name: 'Start shopping' })).toBeEnabled();
});
