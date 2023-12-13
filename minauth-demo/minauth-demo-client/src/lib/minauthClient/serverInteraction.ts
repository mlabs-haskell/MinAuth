import { JsonProof } from 'o1js';

export async function submitProofToServer(proof: JsonProof) {
  try {
    const response = await fetch('/api/submit-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proof)
    });
    if (!response.ok) throw new Error('Proof submission failed.');

    const { token } = await response.json();
    localStorage.setItem('jwt', token); // Save JWT for future requests.
  } catch (error) {
    console.error('Error submitting proof:', error);
  }
}
