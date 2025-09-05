from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime
import sqlite3
import traceback

app = Flask(__name__)

# データベースファイルの絶対パス
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rankings.db')

# --- DB ヘルパー ---

def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"データベース接続エラー: {e}")
        return None

def init_db():
    try:
        print(f"データベース初期化中: {DB_PATH}")
        conn = get_db_connection()
        if conn is None:
            print("データベース接続に失敗しました")
            return False
            
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rankings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL,
                score INTEGER NOT NULL,
                play_time INTEGER NOT NULL,
                player_count INTEGER NOT NULL,
                timestamp TEXT NOT NULL
            )
            """
        )
        conn.commit()
        conn.close()
        print("データベース初期化完了")
        return True
    except Exception as e:
        print(f"データベース初期化エラー: {e}")
        traceback.print_exc()
        return False

# アプリ起動時にデータベースを初期化
if not init_db():
    print("警告: データベース初期化に失敗しました")

@app.route("/")
def index_root():
    try:
        conn = get_db_connection()
        if conn is None:
            return render_template("index.html", rankings=[])
            
        rows = conn.execute(
            "SELECT user_name, score, play_time, player_count, timestamp FROM rankings ORDER BY score DESC, timestamp DESC LIMIT 10"
        ).fetchall()
        conn.close()
        
        rankings = [
            {
                'userName': r['user_name'],
                'score': r['score'],
                'playTime': r['play_time'],
                'playerCount': r['player_count'],
                'timestamp': r['timestamp'],
            }
            for r in rows
        ]
        return render_template("index.html", rankings=rankings)
    except Exception as e:
        print(f"ランキング取得エラー: {e}")
        return render_template("index.html", rankings=[])

@app.route("/start")
def start():
    return render_template("start.html")

@app.route("/game")
def game():
    return render_template("game.html")

@app.route("/submit_score", methods=['POST'])
def submit_score():
    try:
        print("スコア送信リクエスト受信")
        data = request.get_json(force=True, silent=False)
        print(f"受信データ: {data}")
        
        score = int(data.get('score', 0) or 0)
        time_left = int(data.get('timeLeft', 0) or 0)
        player_count = int(data.get('playerCount', 1) or 1)
        user_name = (data.get('userName') or '').strip() or 'Anonymous'

        play_time = 60 - time_left
        
        print(f"処理データ: score={score}, time_left={time_left}, player_count={player_count}, user_name={user_name}, play_time={play_time}")

        conn = get_db_connection()
        if conn is None:
            return jsonify({'success': False, 'error': 'データベース接続エラー'}), 500
            
        conn.execute(
            "INSERT INTO rankings (user_name, score, play_time, player_count, timestamp) VALUES (?, ?, ?, ?, ?)",
            (user_name, score, play_time, player_count, datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
        )
        conn.commit()
        conn.close()
        
        print("スコア保存完了")
        return jsonify({'success': True})
    except Exception as e:
        print(f"スコア送信エラー: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)
