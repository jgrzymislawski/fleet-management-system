export const fetchAllPages = async (apiClient, url, params = {}) => {
  const allResults = [];
  let page = 1;
  const maxPages = 1000;

  while (page <= maxPages) {
    const response = await apiClient.get(url, {
      params: {
        ...params,
        page,
        page_size: 100,
      },
    });

    const data = response.data;

    if (Array.isArray(data)) {
      return data;
    }

    const results = Array.isArray(data?.results) ? data.results : [];

    allResults.push(...results);

    if (!data?.next) {
      break;
    }

    page += 1;
  }

  return allResults;
};
