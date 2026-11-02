import { config } from "../config/config";
import docker from "../utils/docker";
import { readContainerLogs, toDockerApiError } from "../utils/dockerHelpers";
import { ApiError } from "../utils/errors";

const PROJECT_LABEL = "com.docker.compose.project";
const SERVICE_LABEL = "com.docker.compose.service";

export interface ContainerSummary {
  /** Container name without the leading slash, e.g. "backend-api-1". */
  name: string;
  /** Compose service name, e.g. "api". */
  service: string;
  image: string;
  /** "running", "exited", "created", ... */
  state: string;
  /** Docker's human status, e.g. "Up 2 hours (healthy)". */
  status: string;
}

const unreachable = (error: unknown) =>
  toDockerApiError(error, { notFound: "Container not found" });

/** The stack's containers. Only these can be read, never other containers on the host. */
const listProjectContainers = async (): Promise<ContainerSummary[]> => {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { label: [`${PROJECT_LABEL}=${config.docker.composeProject}`] },
    });
    return containers
      .map((c) => ({
        name: (c.Names[0] ?? c.Id).replace(/^\//, ""),
        service: c.Labels?.[SERVICE_LABEL] ?? "",
        image: c.Image,
        state: c.State,
        status: c.Status,
      }))
      .sort((a, b) => a.service.localeCompare(b.service) || a.name.localeCompare(b.name));
  } catch (error) {
    throw unreachable(error);
  }
};

export const ContainerService = {
  list: listProjectContainers,
  async logs(name: string, options: { tail: number; timestamps: boolean }): Promise<string> {
    const containers = await listProjectContainers();
    if (!containers.some((c) => c.name === name)) {
      throw new ApiError(404, `No container named "${name}" in this stack`);
    }
    try {
      return await readContainerLogs(docker.getContainer(name), options);
    } catch (error) {
      throw unreachable(error);
    }
  },
};
