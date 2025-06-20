import React from 'react';
import { createAssistant, createSmartappDebugger } from '@salutejs/client';
import './Pong.css';

const CANVAS_WIDTH = window.innerWidth*0.98;
const CANVAS_HEIGHT = window.innerHeight*0.9-200;
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;  
const BALL_SIZE = 15;
const PADDLE_SPEED = 8;
const BALL_SPEED = 6;
const BOT_REACTION_DELAY = 0.7; // Задержка реакции бота

const initializeAssistant = (getState, getRecoveryState) => {
  if (process.env.NODE_ENV === 'development') {
    return createSmartappDebugger({
      token: process.env.REACT_APP_TOKEN ?? '',
      initPhrase: `Запусти ${process.env.REACT_APP_SMARTAPP}`,
      getState,
      nativePanel: {
        defaultText: 'Голосовые команды',
        screenshotMode: false,
        tabIndex: -1,
      },
    });
  }
  return createAssistant({ getState });
};

export class App extends React.Component {
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
      showHelpModal: true,
      gamePaused: false,
      keysPressed: {}
    };

    this.canvasRef = React.createRef();
    this.animationFrameId = null;

    this.assistant = initializeAssistant(() => this.getStateForAssistant());

    this.assistant.on('data', (event) => {
      console.log('Assistant event:', event);
      if (event.action) {
        this.dispatchAssistantAction(event.action);
      } else if (event.type === 'navigation' && event.navigation?.command) {
        const command = event.navigation.command.toLowerCase();
        this.dispatchAssistantAction({ type: command });
      }
    });
  }

  componentDidMount() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.draw();
    this.gameLoop();
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
        gamePaused: false,
        ballX: CANVAS_WIDTH / 2,
        ballY: CANVAS_HEIGHT / 2,
        ballSpeedX: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED,
        ballSpeedY: Math.random() * BALL_SPEED * 2 - BALL_SPEED,
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

  updateGameState = () => {
    if (!this.state.gameStarted || this.state.gamePaused) return;

    // Движение мяча
    let newBallX = this.state.ballX + this.state.ballSpeedX;
    let newBallY = this.state.ballY + this.state.ballSpeedY;
    let newBallSpeedX = this.state.ballSpeedX;
    let newBallSpeedY = this.state.ballSpeedY;
    let newPlayer1Score = this.state.player1Score;
    let newPlayer2Score = this.state.player2Score;

    // Отскок от границ
    if (newBallY <= 0 || newBallY >= CANVAS_HEIGHT - BALL_SIZE) {
      newBallSpeedY = -newBallSpeedY;
    }

    // Отскок от ракеток
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

    // Голы
    if (newBallX < 0) {
      newPlayer2Score += 1;
      this.setState({ player2Score: newPlayer2Score }, this.resetBall);
      return;
    }

    if (newBallX > CANVAS_WIDTH) {
      newPlayer1Score += 1;
      this.setState({ player1Score: newPlayer1Score }, this.resetBall);
      return;
    }

    // Движение ракеток
    let newPlayer1Y = this.state.player1Y;
    let newPlayer2Y = this.state.player2Y;

    // Управление левой ракеткой (игрок)
    if (this.state.keysPressed['ArrowUp']) {
      newPlayer1Y = Math.max(0, newPlayer1Y - PADDLE_SPEED);
    }
    if (this.state.keysPressed['ArrowDown']) {
      newPlayer1Y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, newPlayer1Y + PADDLE_SPEED);
    }

    // Управление правой ракеткой (бот)
    if (Math.random() > BOT_REACTION_DELAY) { // Добавляем небольшую задержку реакции бота
      const paddleCenter = this.state.player2Y + PADDLE_HEIGHT / 2;
      const ballFutureY = newBallY + (newBallSpeedY * (CANVAS_WIDTH - newBallX) / Math.abs(newBallSpeedX));
      
      if (paddleCenter < ballFutureY - 10) {
        newPlayer2Y = Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, newPlayer2Y + PADDLE_SPEED);
      } else if (paddleCenter > ballFutureY + 10) {
        newPlayer2Y = Math.max(0, newPlayer2Y - PADDLE_SPEED);
      }
    }

    this.setState({
      ballX: newBallX,
      ballY: newBallY,
      ballSpeedX: newBallSpeedX,
      ballSpeedY: newBallSpeedY,
      player1Y: newPlayer1Y,
      player2Y: newPlayer2Y
    });
  };

  gameLoop = () => {
    this.updateGameState();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  draw = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Очистка холста
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Фон
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Центральная линия
    ctx.strokeStyle = 'white';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2, 0);
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Ракетки
    ctx.fillStyle = 'white';
    ctx.fillRect(0, this.state.player1Y, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, this.state.player2Y, PADDLE_WIDTH, PADDLE_HEIGHT);
    
    // Мяч
    ctx.fillRect(this.state.ballX, this.state.ballY, BALL_SIZE, BALL_SIZE);
    
    // Счет
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.state.player1Score.toString(), CANVAS_WIDTH / 4, 50);
    ctx.fillText(this.state.player2Score.toString(), (CANVAS_WIDTH / 4) * 3, 50);
    
    // Сообщение о начале игры
    if (!this.state.gameStarted) {
      ctx.font = '24px Arial';
      ctx.fillText('Нажмите ОК для запуска или скажите "старт"', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
    
    // Сообщение о паузе
    if (this.state.gamePaused) {
      ctx.font = '24px Arial';
      ctx.fillText('Игра на паузе', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }
    
    this.animationFrameId = requestAnimationFrame(this.draw);
  };

  handleKeyDown = (e) => {
    const { keysPressed } = this.state;
    
    this.setState({
      keysPressed: {
        ...keysPressed,
        [e.key]: true
      }
    });

    // Старт игры
    if (e.key === ' ' || e.key === 'Enter') {
      this.startGame();
      if (this.state.showHelpModal) {
        this.setState({ showHelpModal: false, gamePaused: false });
      }
    }
    
    // Помощь
    if (e.key === 'h' || e.key === 'H' || e.key === 'х' || e.key === 'Х') {
      this.setState({ showHelpModal: true, gamePaused: true });
    }
  };

  handleKeyUp = (e) => {
    const { keysPressed } = this.state;
    const newKeysPressed = { ...keysPressed };
    delete newKeysPressed[e.key];
    this.setState({ keysPressed: newKeysPressed });
  };

  dispatchAssistantAction = (action) => {
    if (!action) return;

    console.log('Assistant action:', action);
    switch (action.type) {
      case 'start':
        this.startGame();
        this.setState({ showHelpModal: false, gamePaused: false });
        break;
      case 'help':
        this.setState({ showHelpModal: true, gamePaused: true });
        break;
      case 'stop':
        this.setState({ showHelpModal: false, gamePaused: false });
        break;
      default:
        console.log('Unknown action:', action.type);
    }
  };

  render() {
    return (
      <div className="pong-container">
        <div className="score-board">
          <div className="score">{this.state.player1Score} : {this.state.player2Score}</div>
        </div>
        <canvas
          ref={this.canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="pong-canvas"
        />
        
        {this.state.showHelpModal && (
          <div className="help-modal">
            <div className="help-content">
              <h2>Управление</h2>
              <p><strong>Игрок:</strong> Стрелки вверх, вниз</p>
              <p><strong>Старт:</strong> Скажите "старт"</p>
              <p><strong>Помощь:</strong> Скажите "помощь"</p>
              <p><strong>Закрыть окно помощи:</strong> Скажите "закрыть"</p>
              <button 
                className="close-help" 
                onClick={() => this.setState({ 
                  showHelpModal: false, 
                  gamePaused: false 
                })}
              >
                Закрыть
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}