
VALIDATOR_DIR=validator/
CONTRACT_DIR=contracts/
E2E_DIR=validator/e2e/

BRIDGE_MODE = $(shell echo '$*' | tr '[:lower:]' '[:upper:]' | tr '-' '_')
ENVFILE = "/tmp/thunder_bridge.env"

build-deployer:
	cd $(CONTRACT_DIR) && docker build -t thunder_bridge_deployer .


deploy-truffle-% : build-deployer
	cd $(VALIDATOR_DIR) && docker-compose up -d truffle && sleep 3
	docker run --rm --network=host \
		-e BRIDGE_MODE=${BRIDGE_MODE} \
		-v $(PWD)/contracts/deploy/envs/truffle.env:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-pala: build-deployer
	cd $(VALIDATOR_DIR) && docker-compose up -d pala && sleep 3
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/envs/env.local:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-e2e-%: build-deployer
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml up -d --build
	docker run --rm --network=host \
		-e BRIDGE_MODE=${BRIDGE_MODE} \
		-v $(PWD)/contracts/deploy/envs/e2e.env:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-stress-%: build-deployer
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml up -d --build
	docker run --rm --network=host \
		-e BRIDGE_MODE=${BRIDGE_MODE} \
		-v $(PWD)/contracts/deploy/envs/stress.env:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


clean-chain:
	cd $(VALIDATOR_DIR) && docker-compose down
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml down


run-db:
	cd $(VALIDATOR_DIR) && docker-compose up -d redis rabbitmq

run-%:
	cd $(E2E_DIR) && cp envs/$*.env validator.env
	cd $(E2E_DIR) && docker-compose build validator && docker-compose -p $* up -d

clean-%:
	cd $(E2E_DIR) && cp envs/$*.env validator.env
	cd $(E2E_DIR) && docker-compose -p $* down

test-e2e-%: deploy-e2e-%
	$(MAKE) run-v1
	cd $(E2E_DIR) && \
	docker-compose -f docker-compose-e2e.yaml build e2e-$* && \
	docker-compose -f docker-compose-e2e.yaml run e2e-$*

test-truffle-%: deploy-truffle-%
	cd $(VALIDATOR_DIR) && \
		docker-compose build truffle-test && \
		docker-compose run -e BRIDGE_MODE=${BRIDGE_MODE} --rm truffle-test
	cd $(VALIDATOR_DIR) && docker-compose down

test-truffle-pala: build-deployer
	cd $(VALIDATOR_DIR) && docker-compose run --rm truffle-test-pala
	cd $(VALIDATOR_DIR) && docker-compose down

test-unittest:
	cd $(E2E_DIR) && cp envs/v1.env validator.env
	cd $(VALIDATOR_DIR) && python run-test.py unittest

test-contracts:
	cd $(CONTRACT_DIR) && docker build -t test-contracts -f Dockerfile.test .
	cd $(CONTRACT_DIR) && docker run test-contracts

run-all: run-v1 run-v2 run-v3
	echo "All validator are deployed."

stress-%: deploy-stress-%
	$(MAKE) run-all
	cd $(E2E_DIR) && \
	docker-compose -f docker-compose-stress.yaml run -e BRIDGE_MODE=${BRIDGE_MODE} -d stress-home && \
	docker-compose -f docker-compose-stress.yaml run -e BRIDGE_MODE=${BRIDGE_MODE} -d stress-foreign

crash: deploy-stress
	$(MAKE) run-all
	cd $(VALIDATOR_DIR) && python scripts/crash-test.py | tee crash.log

test-e2e: test-e2e-erc-to-native test-e2e-native-to-erc test-e2e-erc-to-erc

test-truffle: test-truffle-native-to-erc test-truffle-erc-to-erc

test-all: test-e2e test-unittest test-truffle test-contracts clean

clean: clean-chain clean-v1 clean-v2 clean-v3
