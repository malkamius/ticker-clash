export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const fetchOptions: RequestInit = {
    ...options,
    credentials: 'include',
  };
  return fetch(path, fetchOptions);
}
