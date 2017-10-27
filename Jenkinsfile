pipeline {
    agent {
        label 'KZ01_TI-141_OZP_CentOS'
    }
    stages {
        stage('Clear the workspace') {
            steps {
                sh 'sudo rm -rf *'
            }
        }
        stage('Checkout Repo') {
            steps {
                git url: 'http://www.github.com/mark-betters-ozp-forks/ozp-webtop.git', branch: 'master'
            }
        }
        stage('Build') {
            steps {
                sh '''
                  npm install -g bower grunt-cli
                  npm install; npm run bower; npm run build; npm run compile; npm run tarDevDate
                  mv *.tar.gz webtop.tar.gz
                '''
            }
        }
    }
}