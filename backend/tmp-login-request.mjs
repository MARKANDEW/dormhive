const url = 'http://127.0.0.1:5001/api/v1/auth/login';
const payload = { email: 'owner@owner.com', password: 'password' };

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log('status', response.status);
  const text = await response.text();
  console.log(text);
} catch (error) {
  console.error('REQUEST ERROR', error);
}
