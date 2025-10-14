const POST_GRAPHQL_FIELDS = `
  slug
  title
  coverImage {
    url
  }
  date
  author {
    ... on Author {
      name
      picture {
        url
      }
    }
  }
  excerpt
  content {
    json
  }
`;

async function fetchGraphQL(query: string, preview = false): Promise<any> {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const token = preview
    ? process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN
    : process.env.CONTENTFUL_ACCESS_TOKEN;

  if (!spaceId) {
    throw new Error('Missing CONTENTFUL_SPACE_ID environment variable');
  }
  if (!token) {
    throw new Error(
      `Missing ${preview ? 'CONTENTFUL_PREVIEW_ACCESS_TOKEN' : 'CONTENTFUL_ACCESS_TOKEN'} environment variable`,
    );
  }

  const res = await fetch(
    `https://graphql.contentful.com/content/v1/spaces/${spaceId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
      next: { tags: ['posts'] },
    },
  );

  const text = await res.text();

  // If the response is HTML (starts with '<'), it's likely an error page
  if (!res.ok) {
    throw new Error(`Contentful GraphQL request failed: ${res.status} ${res.statusText} - ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    // Provide a helpful message when HTML or other non-JSON is returned
    const snippet = text.slice(0, 500);
    throw new Error(
      `Failed to parse JSON response from Contentful GraphQL endpoint. Response start: ${snippet}`,
    );
  }
}

function extractPost(fetchResponse: any): any {
  return fetchResponse?.data?.postCollection?.items?.[0];
}

function extractPostEntries(fetchResponse: any): any[] {
  if (!fetchResponse?.data?.postCollection?.items) {
    console.error('Failed to fetch posts from Contentful:', fetchResponse);
    return [];
  }
  return fetchResponse.data.postCollection.items;
}

export async function getPreviewPostBySlug(slug: string | null): Promise<any> {
  const entry = await fetchGraphQL(
    `query {
      postCollection(where: { slug: "${slug}" }, preview: true, limit: 1) {
        items {
          ${POST_GRAPHQL_FIELDS}
        }
      }
    }`,
    true,
  );
  return extractPost(entry);
}

export async function getAllPosts(isDraftMode: boolean): Promise<any[]> {
  const entries = await fetchGraphQL(
    `query {
      postCollection(where: { slug_exists: true }, order: date_DESC, preview: ${
        isDraftMode ? 'true' : 'false'
      }) {
        items {
          ${POST_GRAPHQL_FIELDS}
        }
      }
    }`,
    isDraftMode,
  );
  return extractPostEntries(entries);
}

export async function getPostAndMorePosts(
  slug: string,
  preview: boolean,
): Promise<any> {
  const entry = await fetchGraphQL(
    `query {
      postCollection(where: { slug: "${slug}" }, preview: ${
        preview ? 'true' : 'false'
      }, limit: 1) {
        items {
          ${POST_GRAPHQL_FIELDS}
        }
      }
    }`,
    preview,
  );
  const entries = await fetchGraphQL(
    `query {
      postCollection(where: { slug_not_in: "${slug}" }, order: date_DESC, preview: ${
        preview ? 'true' : 'false'
      }, limit: 2) {
        items {
          ${POST_GRAPHQL_FIELDS}
        }
      }
    }`,
    preview,
  );
  return {
    post: extractPost(entry),
    morePosts: extractPostEntries(entries),
  };
}
