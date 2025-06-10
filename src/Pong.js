import React from 'react';
import { createAssistant, createSmartappDebugger } from '@salutejs/client';
import './Pong.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 15;
const PADDLE_SPEED = 8;
const BALL_SPEED = 5;

const initializeAssistant = (getState, getRecoveryState) => {
    if (process.env.NODE_ENV === 'development') {
        return createSmartappDebugger({
            token: process.env.REACT_APP_TOKEN ?? '',
            initPhrase: `Запусти ${process.env.REACT_APP_SMARTAPP}`,
            getState,
            nativePanel: {
                defaultText: '',
                screenshotMode: false,
                tabIndex: -1,
            },
        });
    } else {
        return createAssistant({ getState });
    }
};

export default class Pong extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            player1Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
            player2Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
            ballX: CANVAS_WIDTH / 2,
            ballY: CANVAS_HEIGHT / 2,
            ballSpeedX: BALL_SPEED,
            ballSpeedY: BALL_SPEED,
            player1Score: 0,
            player2Score: 0,
            gameStarted: false,
            showHelpModal: false,
            keys: {
                player1Up: false,
                player1Down: false,
                player2Up: false,
                player2Down: false,
            },
        };

        this.canvasRef = React.createRef();
        this.animationFrameId = null;

        // Привязка методов
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.showHelp = this.showHelp.bind(this);
        this.closeHelp = this.closeHelp.bind(this);

        this.assistant = initializeAssistant(() => this.getStateForAssistant());

        this.assistant.on('data', (event) => {
            console.log(`assistant.on(data)`, event);
            if (event.type === 'character') {
                console.log(`assistant.on(data): character: "${event?.character?.id}"`);
            } else if (event.type === 'insets') {
                console.log(`assistant.on(data): insets`);
            } else if (event.type === 'navigation' && event.navigation?.command) {
                const navCommand = event.navigation.command.toLowerCase();
                this.dispatchAssistantAction({ type: navCommand });
            } else {
                const { action } = event;
                this.dispatchAssistantAction(action);
            }
        });
    }

    componentDidMount() {
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.draw();
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        cancelAnimationFrame(this.animationFrameId);
    }

    getStateForAssistant() {
        return {
            pong_game: {
                player1Score: this.state.player1Score,
                player2Score: this.state.player2Score,
                gameStarted: this.state.gameStarted,
            },
        };
    }

    startGame = () => {
        if (!this.state.gameStarted) {
            this.setState({
                gameStarted: true,
                ballX: CANVAS_WIDTH / 2,
                ballY: CANVAS_HEIGHT / 2,
                ballSpeedX: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED,
                ballSpeedY: Math.random() * BALL_SPEED * 2 - BALL_SPEED,
            }, () => {
                this.gameLoop();
            });
        }
    };

    resetBall = () => {
        this.setState({
            ballX: CANVAS_WIDTH / 2,
            ballY: CANVAS_HEIGHT / 2,
            ballSpeedX: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED,
            ballSpeedY: Math.random() * BALL_SPEED * 2 - BALL_SPEED,
            gameStarted: false,
        });
    };

    gameLoop = () => {
        if (!this.state.gameStarted) return;

        // Move ball
        let newBallX = this.state.ballX + this.state.ballSpeedX;
        let newBallY = this.state.ballY + this.state.ballSpeedY;
        let newBallSpeedX = this.state.ballSpeedX;
        let newBallSpeedY = this.state.ballSpeedY;
        let newPlayer1Score = this.state.player1Score;
        let newPlayer2Score = this.state.player2Score;

        // Ball collision with top and bottom
        if (newBallY <= 0 || newBallY >= CANVAS_HEIGHT - BALL_SIZE) {
            newBallSpeedY = -newBallSpeedY;
        }

        // Ball collision with paddles
        // Player 1 paddle
        if (
            newBallX <= PADDLE_WIDTH &&
            newBallX >= 0 &&
            newBallY + BALL_SIZE >= this.state.player1Y &&
            newBallY <= this.state.player1Y + PADDLE_HEIGHT
        ) {
            newBallSpeedX = -newBallSpeedX * 1.05;
            const hitPosition = (newBallY - this.state.player1Y) / PADDLE_HEIGHT;
            newBallSpeedY = (hitPosition - 0.5) * 10;
        }

        // Player 2 paddle
        if (
            newBallX >= CANVAS_WIDTH - PADDLE_WIDTH - BALL_SIZE &&
            newBallX <= CANVAS_WIDTH &&
            newBallY + BALL_SIZE >= this.state.player2Y &&
            newBallY <= this.state.player2Y + PADDLE_HEIGHT
        ) {
            newBallSpeedX = -newBallSpeedX * 1.05;
            const hitPosition = (newBallY - this.state.player2Y) / PADDLE_HEIGHT;
            newBallSpeedY = (hitPosition - 0.5) * 10;
        }

        // Ball out of bounds - score points
        if (newBallX < 0) {
            newPlayer2Score += 1;
            this.setState({
                player2Score: newPlayer2Score,
            }, this.resetBall);
            return;
        }

        if (newBallX > CANVAS_WIDTH) {
            newPlayer1Score += 1;
            this.setState({
                player1Score: newPlayer1Score,
            }, this.resetBall);
            return;
        }

        // Update state
        this.setState({
            ballX: newBallX,
            ballY: newBallY,
            ballSpeedX: newBallSpeedX,
            ballSpeedY: newBallSpeedY,
        }, () => {
            this.updatePaddles();
            this.animationFrameId = requestAnimationFrame(this.gameLoop);
        });
    };

    draw = () => {
        const canvas = this.canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw background
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Draw center line
        ctx.strokeStyle = 'white';
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2, 0);
        ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw paddles
        ctx.fillStyle = 'white';
        ctx.fillRect(0, this.state.player1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
        ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, this.state.player2Y, PADDLE_WIDTH, PADDLE_HEIGHT);
        
        // Draw ball
        ctx.fillRect(this.state.ballX, this.state.ballY, BALL_SIZE, BALL_SIZE);
        
        // Draw scores
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.state.player1Score.toString(), CANVAS_WIDTH / 4, 50);
        ctx.fillText(this.state.player2Score.toString(), (CANVAS_WIDTH / 4) * 3, 50);
        
        // Draw start message if game not started
        if (!this.state.gameStarted) {
            ctx.font = '24px Arial';
            ctx.fillText('Press SPACE to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        }
        
        this.animationFrameId = requestAnimationFrame(this.draw);
    };

    handleKeyDown(e) {
        const { keys } = this.state;
        
        if (e.key === 'w' || e.key === 'W') {
            this.setState({ keys: { ...keys, player1Up: true } });
        } else if (e.key === 's' || e.key === 'S') {
            this.setState({ keys: { ...keys, player1Down: true } });
        }
        
        if (e.key === 'ArrowUp') {
            this.setState({ keys: { ...keys, player2Up: true } });
        } else if (e.key === 'ArrowDown') {
            this.setState({ keys: { ...keys, player2Down: true } });
        }
        
        if (e.key === ' ') {
            this.startGame();
        }
        
        if (e.key === 'h' || e.key === 'H') {
            this.showHelp();
        }
    }

    handleKeyUp(e) {
        const { keys } = this.state;

        if (e.key === 'w' || e.key === 'W') {
            this.setState({ keys: { ...keys, player1Up: false } });
        } else if (e.key === 's' || e.key === 'S') {
            this.setState({ keys: { ...keys, player1Down: false } });
        }
        
        if (e.key === 'ArrowUp') {
            this.setState({ keys: { ...keys, player2Up: false } });
        } else if (e.key === 'ArrowDown') {
            this.setState({ keys: { ...keys, player2Down: false } });
        }
    }

    updatePaddles() {
        const { keys } = this.state;
        
        this.setState(prevState => ({
            player1Y: keys.player1Up 
                ? Math.max(0, prevState.player1Y - PADDLE_SPEED) 
                : (keys.player1Down 
                    ? Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prevState.player1Y + PADDLE_SPEED) 
                    : prevState.player1Y),
            player2Y: keys.player2Up 
                ? Math.max(0, prevState.player2Y - PADDLE_SPEED) 
                : (keys.player2Down 
                    ? Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prevState.player2Y + PADDLE_SPEED) 
                    : prevState.player2Y),
        }));
    };

    showHelp() {
        this.setState({ showHelpModal: true });
    };

    closeHelp() {
        this.setState({ showHelpModal: false });
    };

    dispatchAssistantAction(action) {
        console.log('dispatchAssistantAction', action);
        if (action) {
            switch (action.type) {
                case 'up':
                    this.setState(prevState => ({
                        player2Y: Math.max(0, prevState.player2Y - PADDLE_SPEED)
                    }));
                    break;
                case 'down':
                    this.setState(prevState => ({
                        player2Y: Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, prevState.player2Y + PADDLE_SPEED)
                    }));
                    break;
                
                case 'help': 
                    this.showHelp();
                    console.log("ohihihihiihi");
                    break;
                default:
                    console.log('Unknown action type:', action.type);
            }
        }
    }


    render() {
        return (
            <div className="pong-container">
                <h1>Pong Game</h1>
                <canvas
                    ref={this.canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="pong-canvas"
                />
                
                {this.state.showHelpModal && (
                    <div className="modal-backdrop">
                        <div className="modal-content">
                            <h2>Помощь</h2>
                            <pre>
                                {`🔹 Управление:
— Игрок 1: W (вверх), S (вниз)
— Игрок 2: Стрелки вверх/вниз
— Начать игру: Пробел

🔹 Голосовые команды:
— "вверх", "вниз" - управление правой ракеткой
— "старт" - начать игру
— "помощь" - показать это сообщение

🔹 Цель:
— Отбивайте мяч ракеткой
— Не пропускайте мяч за свою ракетку`}
                            </pre>
                            <button onClick={this.closeHelp}>Закрыть</button>
                        </div>
                    </div>
                )}
            </div>
        );
    }
}