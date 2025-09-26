/* === あなたが提供したスクリプトを一部調整（ランキング移動先を /index に変更）して組み込んでいます === */
document.addEventListener('DOMContentLoaded', () => {
  let game = null;

  document.getElementById('startBtn').addEventListener('click', () => {
    const radios = document.getElementsByName('playerCount');
    let playerCount = 1;
    for (const r of radios) {
      if (r.checked) playerCount = parseInt(r.value);
    }

    const userNameInput = document.getElementById('userNameInput');
    const userName = (userNameInput && userNameInput.value.trim()) || 'Anonymous';

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game').style.display = 'block';
    const touchControls = document.getElementById('touchControls');
    if (touchControls) touchControls.style.display = 'flex';

    if (game) {
      game.destroy(true);
      document.getElementById('game').innerHTML = '<div id="phaser-container"></div>';
    }

    startGame(playerCount, userName);
  });

  function startGame(playerCount, userName) {
    class MainScene extends Phaser.Scene {
      constructor() {
        super('main');
        this.score = 0;
        this.timeLeft = 60;
        this.playerCount = playerCount;
        this.userName = userName;
        this.isGameOver = false;
        this.timerEvent = null;
        this.enemies = [];
        this.platforms = [];
        this.touch = { left: false, right: false, upPressedOnce: false, upHeld: false };
      }

      preload() {
        this.load.image('ground', 'https://labs.phaser.io/assets/sprites/platform.png');
      }

      create() {
        this.platforms = this.physics.add.staticGroup();
        this.setupTouchControls();

        const startGround = this.add.rectangle(400, 580, 800, 40, 0x555555);
        this.physics.add.existing(startGround, true);
        this.platforms.add(startGround);

        let lastX = 800;
        for (let i = 0; i < 5; i++) {
          const y = Phaser.Math.Between(400, 550);
          const width = Phaser.Math.Between(100, 250);
          const block = this.add.rectangle(lastX, y, width, 20, 0x888888);
          this.physics.add.existing(block, true);
          this.platforms.add(block);
          lastX += width + Phaser.Math.Between(50, 150);
        }
        this.lastX = lastX;

        const player1 = this.add.circle(100, 450, 15, 0xff0000);
        this.physics.add.existing(player1);
        player1.body.setBounce(0.2).setCollideWorldBounds(true);
        player1.jumpCount = 0;
        this.physics.add.collider(player1, this.platforms);
        this.player1 = player1;

        let player2 = null;
        if (this.playerCount === 2) {
          player2 = this.add.circle(200, 450, 15, 0x0000ff);
          this.physics.add.existing(player2);
          player2.body.setBounce(0.2).setCollideWorldBounds(true);
          player2.jumpCount = 0;
          this.physics.add.collider(player2, this.platforms);
          this.player2 = player2;
        }

        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
          w: Phaser.Input.Keyboard.KeyCodes.W,
          a: Phaser.Input.Keyboard.KeyCodes.A,
          s: Phaser.Input.Keyboard.KeyCodes.S,
          d: Phaser.Input.Keyboard.KeyCodes.D,
        });

        this.cameras.main.setBounds(0, 0, Number.MAX_SAFE_INTEGER, 600);
        this.physics.world.setBounds(0, 0, Number.MAX_SAFE_INTEGER, 600);
        this.cameras.main.startFollow(player1, true, 0.05, 0.05);

        this.scoreText = this.add.text(16, 16, 'Score: 0', {fontSize: '24px', fill: '#fff'}).setScrollFactor(0);
        this.timerText = this.add.text(16, 40, 'Time: 60', {fontSize: '32px', fill: '#fff'}).setScrollFactor(0);
        this.timerEvent = this.time.addEvent({
          delay: 1000,
          callback: () => {
            if (this.isGameOver) return;
            this.timeLeft--;
            this.timerText.setText('Time: ' + this.timeLeft);
            if (this.timeLeft <= 0) {
              this.gameOver();
            }
          },
          loop: true,
        });

        this.spawnEnemies();
      }

      setupTouchControls() {
        const btnLeft = document.getElementById('btnLeft');
        const btnRight = document.getElementById('btnRight');
        const btnUp = document.getElementById('btnUp');
        const addPress = (el, onDown, onUp) => {
          if (!el) return;
          const down = (e) => { e.preventDefault(); onDown(); };
          const up = (e) => { e.preventDefault(); onUp(); };
          el.addEventListener('touchstart', down, { passive: false });
          el.addEventListener('mousedown', down);
          el.addEventListener('touchend', up, { passive: false });
          el.addEventListener('mouseup', up);
          el.addEventListener('mouseleave', up);
          el.addEventListener('touchcancel', up, { passive: false });
        };
        addPress(btnLeft, () => { this.touch.left = true; }, () => { this.touch.left = false; });
        addPress(btnRight, () => { this.touch.right = true; }, () => { this.touch.right = false; });
        addPress(btnUp,
          () => { this.touch.upHeld = true; this.touch.upPressedOnce = true; },
          () => { this.touch.upHeld = false; }
        );
      }

      spawnEnemies() {
        this.platforms.children.entries.forEach((platform, index) => {
          if (index > 0) {
            const enemy = this.add.circle(platform.x, platform.y - 25, 12, 0x800080);
            this.physics.add.existing(enemy);
            enemy.body.setBounce(0.3).setCollideWorldBounds(false);
            enemy.direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
            enemy.speed = Phaser.Math.Between(80, 150);
            enemy.platform = platform;
            enemy.jumpCooldown = 0;
            enemy.behaviorTimer = 0;
            enemy.behavior = 'patrol';
            this.physics.add.collider(enemy, this.platforms);
            this.physics.add.collider(enemy, this.player1, this.hitEnemy, null, this);
            if (this.player2) this.physics.add.collider(enemy, this.player2, this.hitEnemy, null, this);
            this.enemies.push(enemy);
          }
        });
      }

      hitEnemy(player, enemy) {
        if (this.isGameOver) return;
        this.gameOver();
      }

      update() {
        if (this.isGameOver) return;
        this.checkPlayerFall();
        this.updateEnemies();

        const p1 = this.player1;
        const moveLeft = this.keys.a.isDown || this.touch.left;
        const moveRight = this.keys.d.isDown || this.touch.right;
        if (moveLeft && !moveRight) p1.body.setVelocityX(-160);
        else if (moveRight && !moveLeft) p1.body.setVelocityX(160);
        else p1.body.setVelocityX(0);

        const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.w) || this.touch.upPressedOnce;
        if (jumpPressed && p1.jumpCount < 2) {
          p1.body.setVelocityY(-330);
          p1.jumpCount++;
        }
        if (p1.body.touching.down) p1.jumpCount = 0;
        this.touch.upPressedOnce = false;

        if (this.playerCount === 2 && this.player2) {
          const p2 = this.player2;
          if (this.cursors.left.isDown) p2.body.setVelocityX(-160);
          else if (this.cursors.right.isDown) p2.body.setVelocityX(160);
          else p2.body.setVelocityX(0);

          if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && p2.jumpCount < 2) {
            p2.body.setVelocityY(-330);
            p2.jumpCount++;
          }
          if (p2.body.touching.down) p2.jumpCount = 0;
        }

        const cameraRight = this.cameras.main.scrollX + this.cameras.main.width;
        if (cameraRight + 200 > this.lastX) {
          const y = Phaser.Math.Between(400, 550);
          const width = Phaser.Math.Between(100, 250);
          const block = this.add.rectangle(this.lastX, y, width, 20, 0x888888);
          this.physics.add.existing(block, true);
          this.physics.add.collider(this.player1, block);
          if (this.player2) this.physics.add.collider(this.player2, block);

          const enemy = this.add.circle(this.lastX, y - 25, 12, 0x800080);
          this.physics.add.existing(enemy);
          enemy.body.setBounce(0.3).setCollideWorldBounds(false);
          enemy.direction = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
          enemy.speed = Phaser.Math.Between(80, 150);
          enemy.platform = block;
          enemy.jumpCooldown = 0;
          enemy.behaviorTimer = 0;
          enemy.behavior = 'patrol';

          this.physics.add.collider(enemy, this.platforms);
          this.physics.add.collider(enemy, this.player1, this.hitEnemy, null, this);
          if (this.player2) this.physics.add.collider(enemy, this.player2, this.hitEnemy, null, this);

          this.enemies.push(enemy);
          this.platforms.add(block);

          this.lastX += width + Phaser.Math.Between(150, 350);
        }

        this.platforms.children.entries.forEach((block, index) => {
          if (block.x + block.width / 2 < this.cameras.main.scrollX - 100) {
            this.enemies = this.enemies.filter(enemy => {
              if (enemy.platform === block) {
                enemy.destroy();
                return false;
              }
              return true;
            });
            block.destroy();
          }
        });

        this.score = Math.floor(this.cameras.main.scrollX / 10);
        this.scoreText.setText('Score: ' + this.score);
      }

      checkPlayerFall() {
        const fallThreshold = 580;
        if (this.player1 && this.player1.y > fallThreshold) {
          this.gameOver();
          return;
        }
        if (this.playerCount === 2 && this.player2 && this.player2.y > fallThreshold) {
          this.gameOver();
          return;
        }
      }

      updateEnemies() {
        this.enemies.forEach(enemy => {
          if (!enemy.active) return;
          enemy.behaviorTimer += 1;
          if (enemy.behaviorTimer > 90) {
            enemy.behaviorTimer = 0;
            enemy.behavior = Phaser.Math.RND.pick(['patrol', 'jump', 'changeDirection', 'pause', 'patrol', 'patrol']);
          }
          if (enemy.jumpCooldown > 0) enemy.jumpCooldown--;
          switch (enemy.behavior) {
            case 'patrol': this.patrolBehavior(enemy); break;
            case 'jump': this.jumpBehavior(enemy); break;
            case 'changeDirection': this.changeDirectionBehavior(enemy); break;
            case 'pause': this.pauseBehavior(enemy); break;
          }
          if (!enemy.body.touching.down) {
            enemy.body.setVelocityY(enemy.body.velocity.y + 15);
          }
        });
      }

      patrolBehavior(enemy) {
        const platform = enemy.platform;
        if (platform && platform.active) {
          const platformLeft = platform.x - platform.width / 2;
          const platformRight = platform.x + platform.width / 2;
          if (enemy.x <= platformLeft + 15 || enemy.x >= platformRight - 15) enemy.direction *= -1;
          enemy.body.setVelocityX(enemy.speed * enemy.direction);
        } else {
          if (enemy.body.touching.down) {
            enemy.direction = Phaser.Math.Between(-1, 1);
            enemy.body.setVelocityX(enemy.speed * enemy.direction);
          }
        }
      }

      jumpBehavior(enemy) {
        if (enemy.jumpCooldown <= 0 && enemy.body.touching.down) {
          const jumpDirection = Phaser.Math.Between(-1, 1);
          enemy.body.setVelocityX(enemy.speed * jumpDirection);
          enemy.body.setVelocityY(-250);
          enemy.jumpCooldown = 60;
          enemy.behavior = 'patrol';
        }
      }

      changeDirectionBehavior(enemy) {
        enemy.direction *= -1;
        enemy.behavior = 'patrol';
      }

      pauseBehavior(enemy) {
        enemy.body.setVelocityX(0);
        if (enemy.behaviorTimer > 60) enemy.behavior = 'patrol';
      }

      gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        if (this.timerEvent) { this.timerEvent.remove(false); this.timerEvent = null; }

        this.add.text(this.cameras.main.scrollX + 250, 250, 'GAME OVER', { fontSize: '64px', fill: '#ff0000' });

        this.physics.pause();
        if (this.player1 && this.player1.setFillStyle) this.player1.setFillStyle(0xff0000);
        if (this.player2 && this.player2.setFillStyle) this.player2.setFillStyle(0xff0000);

        // スコア送信
        fetch('/submit_score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: this.score,
            timeLeft: this.timeLeft,
            playerCount: this.playerCount,
            userName: this.userName,
          }),
        })
        .then(async response => {
          const text = await response.text();
          let json = {};
          try { json = text ? JSON.parse(text) : {}; } catch (e) { console.error('JSON parse error:', e, text); }
          console.log('submit_score response:', response.status, json);
          // 成功/失敗に関わらずランキング画面へ遷移（成功なら即、そうでなくても3秒後）
          if (response.ok && json.success) {
            setTimeout(() => { window.location.href = '/index'; }, 1000);
          } else {
            setTimeout(() => { window.location.href = '/index'; }, 3000);
          }
        })
        .catch(error => {
          console.error('スコア送信エラー:', error);
          setTimeout(() => { window.location.href = '/index'; }, 3000);
        });

        this.add
          .text(this.cameras.main.scrollX + 300, 350, 'ランキングを見る', {
            fontSize: '32px',
            fill: '#00ff00',
            backgroundColor: '#000',
            padding: { x: 10, y: 5 },
          })
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            window.location.href = '/index';
          });
      }
    }

    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: 'phaser-container',
      backgroundColor: '#222',
      physics: { default: 'arcade', arcade: { gravity: { y: 500 }, debug: false } },
      scene: MainScene,
    });
  }
});