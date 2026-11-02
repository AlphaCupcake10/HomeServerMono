import Docker from "dockerode";

// No options: docker-modem honours the standard DOCKER_HOST (unix://, npipe://, tcp://) and
// otherwise defaults to /var/run/docker.sock on Linux/macOS and the named pipe on Windows.
const docker = new Docker();

export default docker;
