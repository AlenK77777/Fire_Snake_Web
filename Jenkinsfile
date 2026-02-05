pipeline {
    agent any
    
    environment {
        APP_NAME = 'fire-snake-game'
        DOCKER_IMAGE = 'alen77777/fire_snake_web'
    }
    
    stages {
        stage('Checkout') {
            steps {
                git url: 'https://github.com/AlenK77777/Fire_Snake_Web.git', branch: 'main'
            }
        }
        
        stage('Compile and Test') {
            steps {
                bat "mvn clean compile test"
            }
        }
        
        stage('Build JAR File') {
            steps {
                bat "mvn package -DskipTests"
            }
        }
        
        stage('Build Docker Image') {
            steps {
                bat "docker build -t ${DOCKER_IMAGE}:latest ."
            }
        }
        
        stage('Push to Docker Hub') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    bat "docker login -u %DOCKER_USER% -p %DOCKER_PASS%"
                    bat "docker push ${DOCKER_IMAGE}:latest"
                }
            }
        }
    }
    
    post {
        success {
            echo 'Pipeline успешно завершён!'
        }
        failure {
            echo 'Pipeline завершился с ошибкой'
        }
        always {
            // Выход из Docker Hub
            bat "docker logout"
        }
    }
}