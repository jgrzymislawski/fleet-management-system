export const fetchAllPages = async (
  apiClient,
  url,
  params = {},
) => {
  const allResults = [];
  let page = 1;

  while (true) {
    const response = await apiClient.get(url, {
      params: {
        ...params,
        page,
        page_size: 100,
      },
    });

    if (Array.isArray(response.data)) {
      return response.data;
    }

    const results = response.data?.results || [];

    allResults.push(...results);

    if (!response.data?.next) {
      break;
    }

    page += 1;
  }

  return allResults;
};
