# Build docker image

docker build -t iot\_dev\_environment\_image2 .

# Create docker container (interactive)

docker run -it --name iot\_dev\_environment2 -v /home/callanor01/Documents/works/puj:/app -v /var/run/docker.sock:/var/run/docker.sock iot\_dev\_environment\_image2 bash

# Create docker container (detached)

docker run -d --name iot\_dev\_environment -v /home/callanor01/Documents/works/puj:/app -v /var/run/docker.sock:/var/run/docker.sock iot\_dev\_environment\_image

# Enter the running docker container

docker exec -it iot\_dev\_environment2 bash

docker exec -it 851638e9dfbc bash

AWS
cat .aws/credentials

Terminal: aws configure

# Configure AWS CLI in docker container

1. Launch Learner Lab
2. In the prompt cat .aws/credentials
3. In the docker container: aws configure

   * use the learnerLab credentials
4. In /root/.aws/credentials put the learnerLab credentials
5. Test, aws s3 ls

