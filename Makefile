
VALIDATOR_DIR=validator/
E2E_DIR=validator/e2e/

build-deployer:
	docker build -t thunder_bridge_deployer contracts


deploy-truffle: build-deployer
	# cd $(VALIDATOR_DIR) && npm run dev-chain
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.local:/contracts/deploy/.env \
		-v $(PWD)/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-testnet: build-deployer
	docker run --rm --network=host \
		-e ERC20_TOKEN_ADDRESS=0x8Ce5466b6a7Fa180079E44ee3422E81FC70cf71b \
		-v $(PWD)/contracts/deploy/env.testnet:/contracts/deploy/.env \
		-v $(PWD)/data-testnet:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-e2e: build-deployer
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml up -d --build
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.e2e:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-stress: build-deployer
	cd $(E2E_DIR) && docker-compose -f docker-compose-infra.yaml up -d --build
	docker run --rm --network=host \
		-v $(PWD)/contracts/deploy/env.stress:/contracts/deploy/.env \
		-v $(PWD)/validator/data:/contracts/deploy/data \
		thunder_bridge_deployer


deploy-v1: deploy-stress
	cd $(E2E_DIR) && cp envs/v1.env validator.env
	cd $(E2E_DIR) && docker-compose build validator && docker-compose -p v1 up -d

deploy-v2: deploy-stress
	cd $(E2E_DIR) && cp envs/v2.env validator.env
	cd $(E2E_DIR) && docker-compose build validator && docker-compose -p v2 up -d

deploy-v3: deploy-stress
	cd $(E2E_DIR) && cp envs/v3.env validator.env
	cd $(E2E_DIR) && docker-compose build validator && docker-compose -p v3 up -d

e2e-test: deploy-v1
	cd $(E2E_DIR) && docker-compose -f docker-compose-e2e.yaml run e2e

deploy-all: deploy-v1 deploy-v2 deploy-v3

stress: deploy-all
	cd $(E2E_DIR) && docker-compose -f docker-compose-stress.yaml up -d

crash: deploy-all
	cd $(VALIDATOR_DIR) && python scripts/crash-test.py | tee crash.log
