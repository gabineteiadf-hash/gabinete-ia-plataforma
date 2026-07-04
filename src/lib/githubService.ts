/**
 * GitHub API Services
 */

export interface GitHubProfile {
  login: string;
  avatar_url: string;
  name: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string;
}

// 1. Fetch GitHub User Profile to verify token
export async function getGitHubProfile(token: string): Promise<GitHubProfile> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Token do GitHub inválido ou expirado");
  }

  return response.json();
}

// 2. Fetch User's Repositories
export async function getGitHubRepos(token: string): Promise<GitHubRepo[]> {
  const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Erro ao buscar repositórios do GitHub");
  }

  return response.json();
}

// 3. Create or Update File on GitHub
export async function createGitHubFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  commitMessage: string
): Promise<any> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  
  // First, check if file exists to get its SHA (needed for updating)
  let sha: string | undefined;
  try {
    const checkRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (checkRes.ok) {
      const fileData = await checkRes.json();
      sha = fileData.sha;
    }
  } catch (e) {
    // File doesn't exist, ignore
  }

  const base64Content = btoa(unescape(encodeURIComponent(content)));

  const body: any = {
    message: commitMessage,
    content: base64Content,
  };

  if (sha) {
    body.sha = sha;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "Erro ao salvar arquivo no GitHub");
  }

  return response.json();
}
