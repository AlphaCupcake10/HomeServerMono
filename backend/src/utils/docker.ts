import Docker from "dockerode";

const docker = new Docker({ socketPath: process.env.DOCKER_HOST ?? "/var/run/docker.sock" });

export default docker;
