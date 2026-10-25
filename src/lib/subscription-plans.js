export const subscriptionPlans = [
  { id: 'monthly', name: 'Monthly', months: 1, price: 7000, monthlyPrice: 7000 },
  { id: 'six-month', name: '6 months', months: 6, price: 30000, monthlyPrice: 5000 },
  { id: 'yearly', name: 'Yearly', months: 12, price: 60000, monthlyPrice: 5000 },
];

export const subscriptionPlan = id => subscriptionPlans.find(plan => plan.id === id);
export const monthlyBaseline = subscriptionPlans[0].price;
export const planSavings = plan => monthlyBaseline * plan.months - plan.price;
export const planDiscount = plan => Math.round(planSavings(plan) / (monthlyBaseline * plan.months) * 100);
export const formatPkr = amount => `Rs ${Number(amount).toLocaleString('en-PK')}`;

export const jazzCashAccount = {
  name: 'Muhammad Younus',
  number: '03267073002',
};
